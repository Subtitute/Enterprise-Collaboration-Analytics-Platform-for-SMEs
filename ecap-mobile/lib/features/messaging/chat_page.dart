import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as sio;

import '../../core/api_client.dart';
import '../../core/auth_session.dart';
import '../../core/date_format.dart';
import '../../core/user_directory.dart';
import '../../models/conversation.dart';
import '../../models/message.dart';

/// Man hinh 1 cuoc tro chuyen - tai lich su qua REST (moi lan mo) + ket noi 1 WebSocket RIENG cua
/// man hinh nay de nhan tin nhan moi thoi gian thuc trong luc dang mo (joinConversation luc vao,
/// leaveConversation luc roi - dung dung hop dong da thong nhat voi apps/messaging-service).
class ChatPage extends StatefulWidget {
  final ApiClient apiClient;
  final AuthSession session;
  final UserDirectory userDirectory;
  final Conversation conversation;

  const ChatPage({
    super.key,
    required this.apiClient,
    required this.session,
    required this.userDirectory,
    required this.conversation,
  });

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  List<Message> _messages = [];
  bool _loading = true;
  String? _errorMessage;
  bool _sending = false;
  final _bodyController = TextEditingController();
  final _scrollController = ScrollController();
  sio.Socket? _socket;

  @override
  void initState() {
    super.initState();
    _load();
    widget.userDirectory.ensureLoaded().then((_) {
      if (mounted) setState(() {});
    });
    _connectSocket();
    // Danh dau da doc ngay khi mo man hinh - dung y nghia "dang xem" cua PATCH .../read, khong doi
    // nguoi dung phai cuon het tin nhan moi tinh la da doc.
    _markRead();
  }

  void _connectSocket() {
    final socket = widget.apiClient.connectMessagingSocket();
    socket.onConnect((_) => socket.emit('joinConversation', {'conversationId': widget.conversation.id}));
    socket.on('message:new', _handleIncomingMessage);
    socket.connect();
    _socket = socket;
  }

  void _handleIncomingMessage(dynamic data) {
    if (!mounted || data is! Map) return;
    if (data['conversationId'] != widget.conversation.id) return;
    final rawMessage = data['message'];
    if (rawMessage is! Map) return;
    try {
      final incoming = Message.fromJson(Map<String, dynamic>.from(rawMessage));
      setState(() => _messages = insertMessageSorted(_messages, incoming));
      _scrollToBottomSoon();
      // 28/09/2026: payload WebSocket khong bao gio la ApiException (khong di qua ApiClient) - chi
      // co the sai hinh dang (TypeError khi Message.fromJson ep kieu field) - bo qua 1 su kien loi,
      // KHONG duoc lam sap ca man hinh chat dang mo vi 1 goi tin realtime bat thuong.
    } on TypeError {
      // Xem giai thich ngay tren.
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final messages = await widget.apiClient.getMessages(widget.conversation.id, limit: 50);
      if (mounted) setState(() => _messages = messages);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
    _scrollToBottomSoon();
  }

  Future<void> _markRead() async {
    try {
      await widget.apiClient.markConversationRead(widget.conversation.id);
    } on ApiException {
      // Chi la tien ich (an badge chua doc o danh sach) - that bai khong duoc chan viec xem/gui tin
      // nhan cua man hinh nay.
    }
  }

  Future<void> _send() async {
    final body = _bodyController.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final sent = await widget.apiClient.sendConversationMessage(widget.conversation.id, body);
      if (mounted) {
        setState(() => _messages = insertMessageSorted(_messages, sent));
        _bodyController.clear();
        _scrollToBottomSoon();
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _scrollToBottomSoon() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) return;
      _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
    });
  }

  @override
  void dispose() {
    _socket?.emit('leaveConversation', {'conversationId': widget.conversation.id});
    _socket?.dispose();
    _bodyController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  String _senderLabel(String senderId) {
    if (widget.session.user?.id == senderId) return 'Bạn';
    return widget.userDirectory.nameFor(senderId);
  }

  @override
  Widget build(BuildContext context) {
    final title = conversationDisplayTitle(
      widget.conversation,
      selfUserId: widget.session.user?.id,
      nameFor: widget.userDirectory.nameFor,
    );
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Column(
        children: [
          if (_errorMessage != null)
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? const Center(child: Text('Chưa có tin nhắn nào - hãy bắt đầu trò chuyện'))
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(12),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final message = _messages[index];
                          final isMine = widget.session.user?.id == message.senderId;
                          final bubbleColor =
                              (isMine ? Theme.of(context).colorScheme.primary : Colors.grey).withValues(alpha: 0.15);
                          return Align(
                            alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
                            child: Container(
                              constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                              margin: const EdgeInsets.symmetric(vertical: 4),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(color: bubbleColor, borderRadius: BorderRadius.circular(12)),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (widget.conversation.type == ConversationType.group && !isMine)
                                    Text(_senderLabel(message.senderId), style: Theme.of(context).textTheme.labelSmall),
                                  Text(message.body),
                                  Text(
                                    formatDateTimeVi(message.createdAt),
                                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Colors.grey),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _bodyController,
                      decoration: const InputDecoration(hintText: 'Nhập tin nhắn...', border: OutlineInputBorder()),
                      minLines: 1,
                      maxLines: 4,
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _sending
                      ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2))
                      : IconButton(onPressed: _send, icon: const Icon(Icons.send)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
