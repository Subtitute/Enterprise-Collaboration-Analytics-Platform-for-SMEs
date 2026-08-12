import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/date_format.dart';
import '../../models/leave_request.dart';
import '../../models/paginated_response.dart';

class LeaveRequestsPage extends StatefulWidget {
  final ApiClient apiClient;

  const LeaveRequestsPage({super.key, required this.apiClient});

  @override
  State<LeaveRequestsPage> createState() => _LeaveRequestsPageState();
}

class _LeaveRequestsPageState extends State<LeaveRequestsPage> {
  List<LeaveRequest> _requests = [];
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
      final json = await widget.apiClient.get('/leave-requests/me', query: {'limit': 50});
      final page = PaginatedResponse.fromJson(json, LeaveRequest.fromJson);
      setState(() => _requests = page.data);
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openCreateDialog() async {
    final created = await showDialog<bool>(
      context: context,
      builder: (context) => _NewLeaveRequestDialog(apiClient: widget.apiClient),
    );
    if (created == true) _load();
  }

  Color _statusColor(LeaveRequestStatus status) {
    switch (status) {
      case LeaveRequestStatus.approved:
        return Colors.green;
      case LeaveRequestStatus.rejected:
        return Colors.red;
      case LeaveRequestStatus.pending:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nghỉ phép')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateDialog,
        icon: const Icon(Icons.add),
        label: const Text('Tạo yêu cầu'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_errorMessage != null) Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                  if (_requests.isEmpty) const Text('Chưa có yêu cầu nghỉ phép nào'),
                  ..._requests.map(
                    (r) => Card(
                      child: ListTile(
                        title: Text('${formatDateVi(r.startDate)} → ${formatDateVi(r.endDate)}'),
                        subtitle: Text(r.reason),
                        trailing: Chip(
                          label: Text(leaveRequestStatusLabelVi(r.status)),
                          backgroundColor: _statusColor(r.status).withValues(alpha: 0.15),
                          labelStyle: TextStyle(color: _statusColor(r.status)),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _NewLeaveRequestDialog extends StatefulWidget {
  final ApiClient apiClient;

  const _NewLeaveRequestDialog({required this.apiClient});

  @override
  State<_NewLeaveRequestDialog> createState() => _NewLeaveRequestDialogState();
}

class _NewLeaveRequestDialogState extends State<_NewLeaveRequestDialog> {
  DateTime? _startDate;
  DateTime? _endDate;
  final _reasonController = TextEditingController();
  bool _submitting = false;
  String? _errorMessage;

  Future<void> _pickDate({required bool isStart}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null) return;
    setState(() => isStart ? _startDate = picked : _endDate = picked);
  }

  Future<void> _submit() async {
    if (_startDate == null || _endDate == null || _reasonController.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập đầy đủ ngày bắt đầu, ngày kết thúc và lý do');
      return;
    }
    // 07/08/2026: backend (CreateLeaveRequestDto) khong kiem tra thu tu 2 ngay - chan ngay o
    // phia client de tranh gui len 1 yeu cau vo ly (ket thuc truoc khi bat dau).
    if (_endDate!.isBefore(_startDate!)) {
      setState(() => _errorMessage = 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
      return;
    }
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    try {
      await widget.apiClient.postJson('/leave-requests', {
        'startDate': _startDate!.toIso8601String().split('T').first,
        'endDate': _endDate!.toIso8601String().split('T').first,
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
    return AlertDialog(
      title: const Text('Tạo yêu cầu nghỉ phép'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(_startDate == null ? 'Chọn ngày bắt đầu' : formatDateVi(_startDate!.toIso8601String())),
            trailing: const Icon(Icons.calendar_today),
            onTap: () => _pickDate(isStart: true),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(_endDate == null ? 'Chọn ngày kết thúc' : formatDateVi(_endDate!.toIso8601String())),
            trailing: const Icon(Icons.calendar_today),
            onTap: () => _pickDate(isStart: false),
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
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Hủy')),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Gửi'),
        ),
      ],
    );
  }
}
