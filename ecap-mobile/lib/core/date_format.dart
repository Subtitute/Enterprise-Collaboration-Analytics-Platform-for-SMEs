import 'package:intl/intl.dart';

/// Quy uoc gio GMT+7 cho toan he thong (ClaudeRule.md muc 4) - Viet Nam khong co gio mua he
/// nen lech co dinh +7 gio, khong can goi thu vien timezone day du.
DateTime _toGmt7(DateTime utc) => utc.toUtc().add(const Duration(hours: 7));

/// 03/10/2026: "bay gio" quy doi GMT+7 - ham CONG KHAI de cac noi khac can tinh "hom nay/ngay
/// mai/..." tren client (vd leave_detection.dart nhan dien goi y hen lich nghi trong tin nhan chat)
/// tai dung DUNG phep quy doi nay, thay vi tu viet lai "DateTime.now().toUtc().add(Duration(hours:
/// 7))" o noi khac (de bi lech neu sau nay quy uoc +7 gio doi).
DateTime nowGmt7() => _toGmt7(DateTime.now());

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
  return DateFormat('yyyy-MM-dd').format(nowGmt7());
}
