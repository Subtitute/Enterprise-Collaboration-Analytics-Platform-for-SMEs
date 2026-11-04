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

/// 04/11/2026: loai nghi khop LeaveType cua hrm-service (ANNUAL/SICK/UNPAID) + nhan tieng Viet khop
/// apps/web (hrm.json, newLeaveRequestModal.types). DUNG CHUNG cho ca 2 form tao don va danh sach.
const leaveTypeDefault = 'ANNUAL';
const leaveTypeLabelsVi = <String, String>{
  'ANNUAL': 'Nghỉ phép năm (Có lương)',
  'SICK': 'Nghỉ ốm',
  'UNPAID': 'Nghỉ việc riêng (Không lương)',
};

/// Ma la (vd server them loai moi) thi hien nguyen ma, khong vo.
String leaveTypeLabelVi(String type) => leaveTypeLabelsVi[type] ?? type;

/// Khop voi entity LeaveRequest (apps/hrm-service/src/entities/leave-request.entity.ts).
class LeaveRequest {
  final String id;
  final String startDate;
  final String endDate;
  final String reason;
  // 04/11/2026: don cu / API cu khong co leaveType -> mac dinh phep nam, giong mac dinh o server.
  final String leaveType;
  final LeaveRequestStatus status;
  final String? decisionNote;

  LeaveRequest({
    required this.id,
    required this.startDate,
    required this.endDate,
    required this.reason,
    this.leaveType = leaveTypeDefault,
    required this.status,
    required this.decisionNote,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: json['id'] as String,
      startDate: json['startDate'] as String,
      endDate: json['endDate'] as String,
      reason: json['reason'] as String,
      leaveType: json['leaveType'] as String? ?? leaveTypeDefault,
      status: _statusFromJson(json['status'] as String),
      decisionNote: json['decisionNote'] as String?,
    );
  }
}
