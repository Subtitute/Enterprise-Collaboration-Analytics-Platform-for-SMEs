import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as sio;

import '../../core/api_client.dart';
import '../../core/auth_session.dart';
import '../../core/user_directory.dart';
import '../../models/conversation.dart';
import '../../models/user.dart';
import 'chat_page.dart';

/// Nhan tin noi bo (Doc/ECAP_Mobile.md) - danh sach cuoc tro chuyen 1:1/nhom cua nguoi dung, sap
/// xep theo hoat dong gan nhat (server tu sap xep - xem ConversationsService.findAllForUser()).
/// Ket noi 1 WebSocket rieng (song song REST) de danh sach tu cap nhat khi co tin nhan/cuoc tro
/// chuyen moi TRONG LUC dang mo tab nay, khong can nguoi dung tu keo-de-lam-moi.
class ConversationsPage extends StatefulWidget {
  final ApiClient apiClient;
  final AuthSession session;
  final UserDirectory userDirectory;

  const ConversationsPage({
    super.key,
    required this.apiClient,
    required this.session,
    required this.userDirectory,
  });

  @override
  State<ConversationsPage> createState() => _ConversationsPageState();
}

class _ConversationsPageState extends State<ConversationsPage> {
  List<Conversation> _conversations = [];
  bool _loading = true;
  String? _errorMessage;
  sio.Socket? _socket;

  @override
  void initState() {
    super.initState();
    _load();
    widget.userDirectory.ensureLoaded().then((_) {
      // Ten hien thi (conversationDisplayTitle) phu thuoc UserDirectory - ve lai 1 lan sau khi tai
      // xong de thay the nhan tam "Thành viên" bang ten that, khong can goi lai REST.
      if (mounted) setState(() {});
    });
    _connectSocket();
  }

  void _connectSocket() {
    final socket = widget.apiClient.connectMessagingSocket();
    socket.on('message:new', (_) => _refreshSilently());
    socket.on('conversation:new', (_) => _refreshSilently());
    socket.on('conversation:updated', (_) => _refreshSilently());
    socket.connect();
    _socket = socket;
  }

  /// Cap nhat lai danh sach khi co su kien realtime - KHONG hien spinner toan man hinh (khac
  /// _load()) va that bai tham lang (danh sach van giu du lieu REST gan nhat, nguoi dung van
  /// keo-de-lam-moi binh thuong duoc qua RefreshIndicator).
  Future<void> _refreshSilently() async {
    if (!mounted) return;
    try {
      final list = await widget.apiClient.getConversations();
      if (mounted) setState(() => _conversations = list);
    } on ApiException {
      // Xem giai thich o tren - bo qua, khong lam gian doan man hinh dang xem.
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final list = await widget.apiClient.getConversations();
      if (mounted) setState(() => _conversations = list);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openChat(Conversation conversation) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => ChatPage(
          apiClient: widget.apiClient,
          session: widget.session,
          userDirectory: widget.userDirectory,
          conversation: conversation,
        ),
      ),
    );
    // 28/09/2026: xem giai thich mounted-guard tai notifications_page.dart/tasks_page.dart (phat
    // hien qua dot ra soat toan du an) - man hinh nay van song (IndexedStack, khong bi dispose khi
    // chuyen tab), nhung van kiem tra mounted cho chac chan truoc khi setState() sau await.
    if (mounted) _load();
  }

  Future<void> _openNewConversationDialog() async {
    final created = await showDialog<Conversation>(
      context: context,
      builder: (context) => _NewConversationDialog(apiClient: widget.apiClient, session: widget.session),
    );
    if (created != null && mounted) await _openChat(created);
  }

  @override
  void dispose() {
    _socket?.dispose();
    super.dispose();
  }

  String _subtitleFor(Conversation conversation) {
    final lastMessage = conversation.lastMessage;
    if (lastMessage == null) return 'Chưa có tin nhắn';
    final senderId = widget.session.user?.id == lastMessage.senderId ? 'Bạn' : widget.userDirectory.nameFor(lastMessage.senderId);
    return '$senderId: ${lastMessage.body}';
  }

  @override
  Widget build(BuildContext context) {
    final selfId = widget.session.user?.id;
    return Scaffold(
      appBar: AppBar(title: const Text('Nhắn tin')),
      floatingActionButton: FloatingActionButton(
        onPressed: _openNewConversationDialog,
        child: const Icon(Icons.add_comment),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_errorMessage != null) Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                  if (_conversations.isEmpty) const Text('Chưa có cuộc trò chuyện nào'),
                  ..._conversations.map((conversation) {
                    final badge = unreadBadgeLabel(conversation.unreadCount);
                    return Card(
                      child: ListTile(
                        leading: Icon(conversation.type == ConversationType.group ? Icons.groups : Icons.person),
                        title: Text(
                          conversationDisplayTitle(
                            conversation,
                            selfUserId: selfId,
                            nameFor: widget.userDirectory.nameFor,
                          ),
                        ),
                        subtitle: Text(_subtitleFor(conversation), maxLines: 1, overflow: TextOverflow.ellipsis),
                        trailing: badge.isEmpty
                            ? null
                            : CircleAvatar(
                                radius: 12,
                                backgroundColor: Theme.of(context).colorScheme.error,
                                child: Text(
                                  badge,
                                  style: const TextStyle(color: Colors.white, fontSize: 11),
                                ),
                              ),
                        onTap: () => _openChat(conversation),
                      ),
                    );
                  }),
                ],
              ),
      ),
    );
  }
}

/// Tao cuoc tro chuyen moi - chon 1 nguoi (khong dien ten nhom) tao DIRECT, chon nhieu nguoi
/// va/hoac dien ten nhom tao GROUP. Quan ly thanh vien nhom (them/bot sau khi tao) CO CHU DICH
/// khong co UI o day - de lai cho web (Doc/ECAP_Mobile.md, pham vi mobile da chon).
class _NewConversationDialog extends StatefulWidget {
  final ApiClient apiClient;
  final AuthSession session;

  const _NewConversationDialog({required this.apiClient, required this.session});

  @override
  State<_NewConversationDialog> createState() => _NewConversationDialogState();
}

class _NewConversationDialogState extends State<_NewConversationDialog> {
  List<AppUser> _colleagues = [];
  final Set<String> _selectedUserIds = {};
  final _nameController = TextEditingController();
  bool _loadingUsers = true;
  bool _submitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  Future<void> _loadUsers() async {
    setState(() {
      _loadingUsers = true;
      _errorMessage = null;
    });
    try {
      final users = await widget.apiClient.getOrgUsers();
      final selfId = widget.session.user?.id;
      if (mounted) {
        setState(() {
          _colleagues = users.where((u) => u.id != selfId).toList()
            ..sort((a, b) => a.fullName.compareTo(b.fullName));
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _loadingUsers = false);
    }
  }

  Future<void> _submit() async {
    if (_selectedUserIds.isEmpty) {
      setState(() => _errorMessage = 'Chọn ít nhất 1 đồng nghiệp');
      return;
    }
    final name = _nameController.text.trim();
    final isGroup = _selectedUserIds.length > 1 || name.isNotEmpty;
    if (isGroup && name.isEmpty) {
      setState(() => _errorMessage = 'Nhóm từ 2 người trở lên bắt buộc phải có tên');
      return;
    }
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    try {
      final conversation = await widget.apiClient.createConversation(
        type: conversationTypeToJson(isGroup ? ConversationType.group : ConversationType.direct),
        participantUserIds: _selectedUserIds.toList(),
        name: isGroup ? name : null,
      );
      if (mounted) Navigator.of(context).pop(conversation);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cuộc trò chuyện mới'),
      content: SizedBox(
        width: double.maxFinite,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_loadingUsers)
              const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))
            else if (_colleagues.isEmpty)
              const Padding(padding: EdgeInsets.all(8), child: Text('Chưa có đồng nghiệp nào khác trong tổ chức'))
            else
              SizedBox(
                height: 260,
                child: ListView(
                  shrinkWrap: true,
                  children: _colleagues.map((u) {
                    final checked = _selectedUserIds.contains(u.id);
                    return CheckboxListTile(
                      value: checked,
                      title: Text(u.fullName),
                      subtitle: Text(u.email),
                      onChanged: (value) {
                        setState(() {
                          if (value == true) {
                            _selectedUserIds.add(u.id);
                          } else {
                            _selectedUserIds.remove(u.id);
                          }
                        });
                      },
                    );
                  }).toList(),
                ),
              ),
            const SizedBox(height: 8),
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Tên nhóm (bắt buộc nếu chọn từ 2 người trở lên)'),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 8),
              Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Hủy')),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Tạo'),
        ),
      ],
    );
  }
}
