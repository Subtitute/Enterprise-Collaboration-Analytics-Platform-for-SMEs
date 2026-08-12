/// Khop voi LeaveRequestStatus (packages/common-dto/src/enums/leave-request-status.enum.ts).
enum LeaveRequestStatus { pending, approved, rejected }

LeaveRequestStatus _statusFromJson(String raw) {
  switch (raw) {
    case 'APPROVED':
      return LeaveRequestStatus.approved;
    case 'REJECTED':
      return LeaveRequestStatus.rejected;
    default:
      return LeaveRequestStatus.pending;
  }
}

String leaveRequestStatusLabelVi(LeaveRequestStatus status) {
  switch (status) {
    case LeaveRequestStatus.approved:
      return 'Đã duyệt';
    case LeaveRequestStatus.rejected:
      return 'Đã từ chối';
    case LeaveRequestStatus.pending:
      return 'Chờ duyệt';
  }
}

/// Khop voi entity LeaveRequest (apps/hrm-service/src/entities/leave-request.entity.ts).
class LeaveRequest {
  final String id;
  final String startDate;
  final String endDate;
  final String reason;
  final LeaveRequestStatus status;
  final String? decisionNote;

  LeaveRequest({
    required this.id,
    required this.startDate,
    required this.endDate,
    required this.reason,
    required this.status,
    required this.decisionNote,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: json['id'] as String,
      startDate: json['startDate'] as String,
      endDate: json['endDate'] as String,
      reason: json['reason'] as String,
      status: _statusFromJson(json['status'] as String),
      decisionNote: json['decisionNote'] as String?,
    );
  }
}
