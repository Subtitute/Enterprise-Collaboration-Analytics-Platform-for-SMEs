import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/date_format.dart';
import '../../models/notification_item.dart';
import '../../models/paginated_response.dart';

class NotificationsPage extends StatefulWidget {
  final ApiClient apiClient;

  const NotificationsPage({super.key, required this.apiClient});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<NotificationItem> _items = [];
  bool _loading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final json = await widget.apiClient.get('/notifications', query: {'limit': 50});
      final page = PaginatedResponse.fromJson(json, NotificationItem.fromJson);
      setState(() => _items = page.data);
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markAsRead(NotificationItem item) async {
    if (item.isRead) return;
    try {
      await widget.apiClient.patch('/notifications/${item.id}/read');
      // 25/08/2026: fix code review Minor (phat hien qua dot ra soat toan du an lan 3) - _load()
      // goi setState() NGAY dong dau tien (khong cho mounted) - neu widget bi dispose (vd dang xuat)
      // giua luc await patch() o tren dang cho, goi _load() sau do se nem "setState() called after
      // dispose()".
      if (mounted) _load();
    } on ApiException {
      // Bo qua loi khi danh dau doc - khong lam gian doan luong xem thong bao.
    }
  }

  Future<void> _markAllAsRead() async {
    try {
      await widget.apiClient.patch('/notifications/read-all');
      if (mounted) _load();
    } on ApiException {
      // Bo qua loi khi danh dau doc - khong lam gian doan luong xem thong bao.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thông báo'),
        actions: [
          IconButton(
            onPressed: _markAllAsRead,
            icon: const Icon(Icons.done_all),
            tooltip: 'Đánh dấu tất cả đã đọc',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                children: [
                  if (_errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                    ),
                  if (_items.isEmpty)
                    const Padding(padding: EdgeInsets.all(16), child: Text('Chưa có thông báo nào')),
                  ..._items.map(
                    (n) => ListTile(
                      leading: Icon(
                        n.isRead ? Icons.notifications_none : Icons.notifications_active,
                        color: n.isRead ? Colors.grey : Theme.of(context).colorScheme.primary,
                      ),
                      title: Text(n.title, style: TextStyle(fontWeight: n.isRead ? FontWeight.normal : FontWeight.bold)),
                      subtitle: Text('${n.message}\n${formatDateTimeVi(n.createdAt)}'),
                      isThreeLine: true,
                      onTap: () => _markAsRead(n),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
