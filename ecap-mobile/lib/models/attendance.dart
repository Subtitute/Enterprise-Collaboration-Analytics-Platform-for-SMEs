/// Khop voi entity Attendance (apps/hrm-service/src/entities/attendance.entity.ts).
class Attendance {
  final String id;
  final String workDate;
  final DateTime checkInAt;
  final DateTime? checkOutAt;

  Attendance({
    required this.id,
    required this.workDate,
    required this.checkInAt,
    required this.checkOutAt,
  });

  factory Attendance.fromJson(Map<String, dynamic> json) {
    return Attendance(
      id: json['id'] as String,
      workDate: json['workDate'] as String,
      checkInAt: DateTime.parse(json['checkInAt'] as String),
      checkOutAt: json['checkOutAt'] == null ? null : DateTime.parse(json['checkOutAt'] as String),
    );
  }
}
