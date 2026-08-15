/// Khop voi entity Attendance (apps/hrm-service/src/entities/attendance.entity.ts).
class Attendance {
  final String id;
  final String workDate;
  final DateTime checkInAt;
  final DateTime? checkOutAt;

  /// 13/08/2026 (Technical_Spec.md muc 17): null = chua co du lieu de danh gia (thieu quyen vi
  /// tri hoac toa do van phong chua cau hinh) - KHAC voi false. Chi la tin hieu THEM cho Manager
  /// doi chieu voi anh, khong phai dieu kien chan cham cong.
  final bool? checkInIsOnSite;
  final bool? checkOutIsOnSite;

  Attendance({
    required this.id,
    required this.workDate,
    required this.checkInAt,
    required this.checkOutAt,
    required this.checkInIsOnSite,
    required this.checkOutIsOnSite,
  });

  factory Attendance.fromJson(Map<String, dynamic> json) {
    return Attendance(
      id: json['id'] as String,
      workDate: json['workDate'] as String,
      checkInAt: DateTime.parse(json['checkInAt'] as String),
      checkOutAt: json['checkOutAt'] == null ? null : DateTime.parse(json['checkOutAt'] as String),
      checkInIsOnSite: json['checkInIsOnSite'] as bool?,
      checkOutIsOnSite: json['checkOutIsOnSite'] as bool?,
    );
  }
}
