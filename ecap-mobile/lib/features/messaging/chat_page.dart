import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as sio;

import '../../core/api_client.dart';
import '../../core/auth_session.dart';
import '../../core/date_format.dart';
import '../../core/user_directory.dart';
import '../../models/conversation.dart';
import '../../models/message.dart';
import 'leave_detection.dart';

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

  // 03/10/2026: id cac tin nhan DA gui yeu cau nghi thanh cong tu goi y "Hen lich nghi" - chi can
  // song trong phien hien tai (khong can ben qua lan mo app) de khoa nut goi y, tranh gui trung 2
  // lan tu CUNG 1 goi y neu nguoi dung bam lai.
  final Set<String> _leaveRequestedMessageIds = {};

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

  /// 03/10/2026: mo form tao nhanh yeu cau nghi tu goi y "Hen lich nghi" cua [message] - xem
  /// leave_detection.dart ve cach phat hien + suy ra [resolvedDate]. Chi goi khi CHINH NGUOI DUNG
  /// la nguoi gui [message] (da chan tu noi goi - itemBuilder ben duoi), khong co duong nao khac
  /// goi toi ham nay cho tin nhan cua nguoi khac.
  Future<void> _openLeaveQuickCreate(Message message, DateTime resolvedDate) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _LeaveQuickCreateSheet(
        apiClient: widget.apiClient,
        initialDate: resolvedDate,
        initialReason: message.body,
      ),
    );
    if (created == true && mounted) {
      setState(() => _leaveRequestedMessageIds.add(message.id));
    }
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
                          final bubble = Align(
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
                          // 03/10/2026: goi y "Hen lich nghi" - CHI nguoi GUI moi thay (khong bao
                          // gio hien tren tin nhan cua nguoi khac, ke ca trong nhom - gui nham yeu
                          // cau nghi duoi danh nguoi khac la 1 loi nghiem trong that su). Xem
                          // leave_detection.dart ve quy tac nhan dien (dung CHUNG voi apps/web).
                          if (!isMine) return bubble;
                          final detection = detectLeaveIntent(message.body);
                          if (!detection.matched) return bubble;
                          final alreadyRequested = _leaveRequestedMessageIds.contains(message.id);
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              bubble,
                              Padding(
                                padding: const EdgeInsets.only(right: 4, bottom: 4),
                                child: alreadyRequested
                                    ? Chip(
                                        avatar: const Icon(Icons.check_circle, size: 16, color: Colors.green),
                                        label: const Text('Đã gửi yêu cầu nghỉ'),
                                        backgroundColor: Colors.green.withValues(alpha: 0.15),
                                        labelStyle: const TextStyle(color: Colors.green),
                                      )
                                    : ActionChip(
                                        avatar: const Icon(Icons.event_available, size: 16),
                                        label: const Text('Hẹn lịch nghỉ'),
                                        onPressed: () =>
                                            _openLeaveQuickCreate(message, detection.resolvedDate!),
                                      ),
                              ),
                            ],
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

/// 03/10/2026: form tao nhanh 1 yeu cau nghi phep NGAY TU man hinh chat (goi y "Hen lich nghi" -
/// xem leave_detection.dart), khong roi khoi cuoc tro chuyen dang xem. Goi CHUNG 1 API voi man hinh
/// Nghi phep (ApiClient.postJson('/leave-requests', ...), xem _NewLeaveRequestDialog trong
/// leave_requests_page.dart) - KHONG tao duong/ham rieng cho luong nay, de di dung qua quy trinh
/// duyet that va hien ra trong lich su y het 1 yeu cau tao tu man hinh Nghi phep. Chi khac la mac
/// dinh nghi DUNG 1 NGAY (startDate == endDate) vi goi y tu 1 cau tin nhan chi suy ra duoc 1 ngay,
/// khong co khai niem khoang ngay bat dau/ket thuc rieng biet.
class _LeaveQuickCreateSheet extends StatefulWidget {
  final ApiClient apiClient;
  final DateTime initialDate;
  final String initialReason;

  const _LeaveQuickCreateSheet({
    required this.apiClient,
    required this.initialDate,
    required this.initialReason,
  });

  @override
  State<_LeaveQuickCreateSheet> createState() => _LeaveQuickCreateSheetState();
}

class _LeaveQuickCreateSheetState extends State<_LeaveQuickCreateSheet> {
  late DateTime _date;
  late final TextEditingController _reasonController;
  bool _submitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    // Khong dung field initializer cho 2 gia tri nay - "widget" chua san sang tai thoi diem field
    // initializer chay (framework gan widget cho State SAU khi constructor chay xong), phai dat
    // trong initState().
    _date = widget.initialDate;
    _reasonController = TextEditingController(text: widget.initialReason);
  }

  Future<void> _pickDate() async {
    // Cung 1 API showDatePicker() + cung khoang gioi han voi _NewLeaveRequestDialog
    // (leave_requests_page.dart) - chi khac initialDate tro vao ngay DANG CHON (thay vi luon la
    // DateTime.now()) de picker mo dung ngay da duoc goi y suy ra san.
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null) return;
    setState(() => _date = picked);
  }

  Future<void> _submit() async {
    if (_reasonController.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập lý do');
      return;
    }
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    try {
      final dateStr = _date.toIso8601String().split('T').first;
      await widget.apiClient.postJson('/leave-requests', {
        'startDate': dateStr,
        'endDate': dateStr,
        'reason': _reasonController.text.trim(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        // Doi theo chieu cao ban phim - tranh TextField bi ban phim che mat luc dang go ly do.
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Hẹn lịch nghỉ', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(formatDateVi(_date.toIso8601String())),
            trailing: const Icon(Icons.calendar_today),
            onTap: _pickDate,
          ),
          TextField(
            controller: _reasonController,
            decoration: const InputDecoration(labelText: 'Lý do'),
            maxLines: 3,
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 8),
            Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Gửi yêu cầu nghỉ'),
          ),
        ],
      ),
    );
  }
}
