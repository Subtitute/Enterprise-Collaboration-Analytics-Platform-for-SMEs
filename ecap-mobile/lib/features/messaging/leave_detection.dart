import '../../core/date_format.dart';

/// 03/10/2026: nhan dien "y dinh xin nghi phep" trong 1 tin nhan chat - dung CHUNG 1 bo quy tac
/// voi ban apps/web dang xay song song (khac nguoi/khac luc, xem yeu cau tinh nang) de hanh vi
/// nhat quan tren ca 2 nen tang, du KHONG the dung chung code (Dart vs TypeScript). Moi thay doi
/// quy tac o day PHAI doi chieu lai voi ban apps/web tuong ung.
///
/// [matched] = tin nhan co it nhat 1 mau hinh trong danh sach yeu cau khop. [resolvedDate] chi co
/// y nghia khi [matched] la true: la 1 ngay-lich (khong gio/phut) duoc suy ra tu noi dung, hoac
/// "hom nay" (GMT+7) neu tin nhan chi nhac gio/thoi luong ma khong noi ro ngay nao.
class LeaveDetectionResult {
  final bool matched;
  final DateTime? resolvedDate;

  const LeaveDetectionResult({required this.matched, this.resolvedDate});

  static const none = LeaveDetectionResult(matched: false);
}

/// Bang quy doi ky tu co dau tieng Viet -> khong dau, dung TRUOC khi chay cac regex ben duoi vi 2
/// ly do: (1) yeu cau phai "dung sai chinh ta dau tieng Viet mot cach hop ly" (vd go "ngay mai"
/// khong dau van phai khop), va (2) RegExp cua Dart chi coi \b (ranh gioi tu) la ranh gioi quanh ky
/// tu [a-zA-Z0-9_] - 1 chu co dau (vd 'ờ', 'ầ') KHONG duoc tinh la ky tu chu, khien \b dat sai vi
/// tri neu khong bo dau truoc (vd \bmai\b se khong khop dung nhu mong doi quanh cac chu co dau ke
/// ben).
const Map<String, String> _vietnameseDiacriticsMap = {
  'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a',
  'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a',
  'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
  'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e',
  'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
  'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
  'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o',
  'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o',
  'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
  'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u',
  'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
  'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
  'đ': 'd',
};

String _stripDiacritics(String input) {
  final buffer = StringBuffer();
  for (final ch in input.split('')) {
    buffer.write(_vietnameseDiacriticsMap[ch] ?? ch);
  }
  return buffer.toString();
}

String _normalize(String text) => _stripDiacritics(text.toLowerCase());

DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

/// Dart: DateTime.monday..sunday = 1..7 - dung thang gia tri nay lam "dich" cho tung tu thu.
const Map<String, int> _weekdayWords = {
  'hai': DateTime.monday,
  'ba': DateTime.tuesday,
  'tu': DateTime.wednesday,
  'nam': DateTime.thursday,
  'sau': DateTime.friday,
  'bay': DateTime.saturday,
};

/// Phat hien y dinh xin nghi phep trong [text]. [todayGmt7] cho phep truyen "hom nay" gia dinh
/// (dung trong test, xem test/leave_detection_test.dart, de ket qua on dinh khong phu thuoc dong
/// ho that) - bo trong khi dung that se tu lay nowGmt7() (core/date_format.dart, quy uoc GMT+7
/// chung cua toan he thong).
LeaveDetectionResult detectLeaveIntent(String text, {DateTime? todayGmt7}) {
  final today = _dateOnly(todayGmt7 ?? nowGmt7());
  final normalized = _normalize(text);

  final resolvedFromDatePattern = _matchAbsoluteDate(normalized, today) ??
      _matchNgayThangNam(normalized, today) ??
      _matchRelativeDayWord(normalized, today) ??
      _matchWeekday(normalized, today) ??
      _matchRelativeOffset(normalized, today);
  if (resolvedFromDatePattern != null) {
    return LeaveDetectionResult(matched: true, resolvedDate: resolvedFromDatePattern);
  }

  // Khong co mau hinh NGAY nao khop - thu tiep mau hinh GIO/THOI LUONG, mac dinh ngay = hom nay
  // theo dung quy tac ("neu CHI khop gio/thoi luong, khong co ngay cu the").
  if (_hasTimeOrDurationPattern(normalized)) {
    return LeaveDetectionResult(matched: true, resolvedDate: today);
  }

  return LeaveDetectionResult.none;
}

/// "dd/mm" hoac "dd/mm/yyyy" - vd "15/10", "15/10/2026".
final RegExp _absoluteDateRe = RegExp(r'\b(\d{1,2})/(\d{1,2})(?:/(\d{4}))?\b');

DateTime? _matchAbsoluteDate(String normalized, DateTime today) {
  for (final m in _absoluteDateRe.allMatches(normalized)) {
    final day = int.parse(m.group(1)!);
    final month = int.parse(m.group(2)!);
    final year = m.group(3) != null ? int.parse(m.group(3)!) : today.year;
    final parsed = _toValidDate(year, month, day);
    if (parsed != null) return parsed;
  }
  return null;
}

/// "ngày X tháng Y" + tuy chon "năm Z" (sau chuan hoa: "ngay X thang Y nam Z").
final RegExp _ngayThangNamRe = RegExp(r'\bngay\s+(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+nam\s+(\d{4}))?\b');

DateTime? _matchNgayThangNam(String normalized, DateTime today) {
  final m = _ngayThangNamRe.firstMatch(normalized);
  if (m == null) return null;
  final day = int.parse(m.group(1)!);
  final month = int.parse(m.group(2)!);
  final year = m.group(3) != null ? int.parse(m.group(3)!) : today.year;
  return _toValidDate(year, month, day);
}

/// Phong thu ngay/thang khong hop le (vd "31 thang 2") - DateTime se tu "tran" sang thang ke tiep
/// thay vi bao loi, kiem tra lai cho chac ngay/thang tra ve dung khop voi gia tri da nhap.
DateTime? _toValidDate(int year, int month, int day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  final parsed = DateTime(year, month, day);
  if (parsed.year != year || parsed.month != month || parsed.day != day) return null;
  return parsed;
}

DateTime? _matchRelativeDayWord(String normalized, DateTime today) {
  if (RegExp(r'\bhom\s+nay\b').hasMatch(normalized)) return today;
  if (RegExp(r'\bngay\s+mot\b').hasMatch(normalized)) return today.add(const Duration(days: 2));
  if (RegExp(r'\bngay\s+kia\b').hasMatch(normalized)) return today.add(const Duration(days: 2));
  if (RegExp(r'\bngay\s+mai\b').hasMatch(normalized)) return today.add(const Duration(days: 1));
  // "mai" dung mot minh (khong di kem "ngay") van tinh la nhac den ngay mai (vd "Mai em xin nghi
  // nhe") - nhung PHAI la 1 TU RIENG (\b bao quanh) de khong khop nham vao chu CO CHUA "mai" (vd
  // tu tieng Anh "email" chen trong cau - \b that bai ngay truoc "m" cua "email" vi ky tu dung
  // truoc no ('e') la ky tu chu, khong co ranh gioi tu o do).
  if (RegExp(r'\bmai\b').hasMatch(normalized)) return today.add(const Duration(days: 1));
  return null;
}

final RegExp _weekdayRe = RegExp(r'\bthu\s+(hai|ba|tu|nam|sau|bay)\b(?:\s+tuan\s+(nay|sau|toi))?');
final RegExp _chuNhatRe = RegExp(r'\bchu\s+nhat\b(?:\s+tuan\s+(nay|sau|toi))?');

DateTime? _matchWeekday(String normalized, DateTime today) {
  int? targetWeekday;
  String? weekQualifier;

  final weekdayMatch = _weekdayRe.firstMatch(normalized);
  if (weekdayMatch != null) {
    targetWeekday = _weekdayWords[weekdayMatch.group(1)!];
    weekQualifier = weekdayMatch.group(2);
  } else {
    final sundayMatch = _chuNhatRe.firstMatch(normalized);
    if (sundayMatch != null) {
      targetWeekday = DateTime.sunday;
      weekQualifier = sundayMatch.group(1);
    }
  }
  if (targetWeekday == null) return null;

  // Khong neu ro "tuan nay/sau/toi" (hoac neu ro "tuan nay") - lay LAN XUAT HIEN GAN NHAT ke ca
  // hom nay neu trung thu, giong cach nguoi dung noi chuyen thuong hieu "thu Sau" (khong noi ro
  // tuan nao) la "thu Sau sap toi nhat". "tuan sau"/"tuan toi" thi cong them 1 tuan nua.
  var daysToAdd = (targetWeekday - today.weekday) % 7;
  if (daysToAdd < 0) daysToAdd += 7;
  var resolved = today.add(Duration(days: daysToAdd));
  if (weekQualifier == 'sau' || weekQualifier == 'toi') {
    resolved = resolved.add(const Duration(days: 7));
  }
  return resolved;
}

final RegExp _relativeDayOffsetRe = RegExp(r'\b(\d+)\s*ngay\s*(nua|toi|sau)\b');
final RegExp _relativeWeekOffsetRe = RegExp(r'\b(\d+)\s*tuan\s*(nua|toi|sau)\b');

DateTime? _matchRelativeOffset(String normalized, DateTime today) {
  final dayMatch = _relativeDayOffsetRe.firstMatch(normalized);
  if (dayMatch != null) {
    return today.add(Duration(days: int.parse(dayMatch.group(1)!)));
  }
  final weekMatch = _relativeWeekOffsetRe.firstMatch(normalized);
  if (weekMatch != null) {
    return today.add(Duration(days: int.parse(weekMatch.group(1)!) * 7));
  }
  return null;
}

/// Gio/thoi luong - khong mang thong tin NGAY, chi dung de biet co nen hien goi y hay khong (xem
/// detectLeaveIntent() - ngay mac dinh la hom nay neu day la mau hinh DUY NHAT khop).
final List<RegExp> _clockOrDurationPatterns = [
  RegExp(r'\b\d{1,2}h\b'), // "2h", "14h"
  RegExp(r'\b\d{1,2}\s*gio\b'), // "2 gio", "14 gio"
  RegExp(r'\b\d{1,2}:\d{2}\b'), // "14:30"
  RegExp(r'\b\d+\s*tieng\b'), // "2 tieng"
  RegExp(r'\b\d+\s*phut\b'), // "30 phut"
];

bool _hasTimeOrDurationPattern(String normalized) {
  return _clockOrDurationPatterns.any((re) => re.hasMatch(normalized));
}
