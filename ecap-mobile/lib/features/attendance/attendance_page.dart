import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../core/date_format.dart';
import '../../models/attendance.dart';
import '../../models/paginated_response.dart';

/// Cham cong photo-proof - chup 1 anh lam bang chung dinh kem (KHONG nhan dien khuon mat,
/// danh tinh xac dinh qua JWT da dang nhap), dung camera THAT cua dien thoai thay vi webcam
/// laptop nhu ban demo web ban dau - Doc/ECAP_Mobile.md.
class AttendancePage extends StatefulWidget {
  final ApiClient apiClient;

  const AttendancePage({super.key, required this.apiClient});

  @override
  State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends State<AttendancePage> {
  List<Attendance> _history = [];
  Attendance? _today;
  bool _loading = true;
  bool _submitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final json = await widget.apiClient.get('/attendance/me', query: {'limit': 20});
      final page = PaginatedResponse.fromJson(json, Attendance.fromJson);
      final todayKey = todayGmt7DateString();
      final todayMatches = page.data.where((a) => a.workDate == todayKey);
      setState(() {
        _history = page.data;
        _today = todayMatches.isEmpty ? null : todayMatches.first;
      });
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _captureAndSubmit(String action) async {
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    try {
      // 07/08/2026: goi camera nam TRONG try/catch - truoc day nam ngoai nen quyen camera bi
      // tu choi/camera khong kha dung (PlatformException) khong bao gio duoc bat, khien nut
      // "Vao lam"/"Ra ve" nhu khong phan hoi gi thay vi hien thong bao loi ro rang.
      final XFile? photo = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 85);
      if (photo == null) return; // Nguoi dung huy chup anh - khong coi la loi.

      await widget.apiClient.postPhoto('/attendance/$action', File(photo.path));
      await _loadHistory();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(action == 'check-in' ? 'Chấm công vào làm thành công' : 'Chấm công ra về thành công')),
        );
      }
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } catch (_) {
      setState(() => _errorMessage = 'Không thể truy cập camera, vui lòng kiểm tra quyền truy cập');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canCheckIn = _today == null;
    final canCheckOut = _today != null && _today!.checkOutAt == null;

    return Scaffold(
      appBar: AppBar(title: const Text('Chấm công')),
      body: RefreshIndicator(
        onRefresh: _loadHistory,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Hôm nay', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    if (_loading)
                      const Center(child: CircularProgressIndicator())
                    else if (_today == null)
                      const Text('Chưa chấm công hôm nay')
                    else ...[
                      Text('Vào làm lúc: ${formatDateTimeVi(_today!.checkInAt)}'),
                      Text(
                        _today!.checkOutAt == null
                            ? 'Chưa chấm công ra về'
                            : 'Ra về lúc: ${formatDateTimeVi(_today!.checkOutAt!)}',
                      ),
                    ],
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 8),
                      Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                    ],
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: canCheckIn && !_submitting ? () => _captureAndSubmit('check-in') : null,
                            icon: const Icon(Icons.camera_alt),
                            label: const Text('Vào làm'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: canCheckOut && !_submitting ? () => _captureAndSubmit('check-out') : null,
                            icon: const Icon(Icons.camera_alt),
                            label: const Text('Ra về'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text('Lịch sử chấm công', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (!_loading && _history.isEmpty) const Text('Chưa có bản ghi chấm công nào'),
            ..._history.map(
              (a) => ListTile(
                leading: const Icon(Icons.event_available),
                title: Text(formatDateVi(a.workDate)),
                subtitle: Text(
                  'Vào: ${formatDateTimeVi(a.checkInAt)}'
                  '${a.checkOutAt != null ? ' · Ra: ${formatDateTimeVi(a.checkOutAt!)}' : ''}',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
