import 'package:intl/intl.dart';

/// Quy uoc gio GMT+7 cho toan he thong (ClaudeRule.md muc 4) - Viet Nam khong co gio mua he
/// nen lech co dinh +7 gio, khong can goi thu vien timezone day du.
DateTime _toGmt7(DateTime utc) => utc.toUtc().add(const Duration(hours: 7));

String formatDateTimeVi(DateTime utc) {
  return DateFormat('HH:mm dd/MM/yyyy').format(_toGmt7(utc));
}

String formatDateVi(String isoDate) {
  final date = DateTime.parse(isoDate);
  return DateFormat('dd/MM/yyyy').format(date);
}

/// Ngay lam viec hom nay theo GMT+7, dang 'YYYY-MM-DD' - PHAI khop chinh xac cach tinh
/// toGmt7DateString() ben backend (apps/hrm-service/src/attendance/attendance-date.util.ts)
/// de xac dinh dung ban ghi cham cong "cua hom nay" trong danh sach lich su tra ve.
String todayGmt7DateString() {
  final now7 = _toGmt7(DateTime.now());
  return DateFormat('yyyy-MM-dd').format(now7);
}
