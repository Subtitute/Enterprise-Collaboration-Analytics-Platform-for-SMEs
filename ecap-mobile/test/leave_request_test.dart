// 04/11/2026: test don vi cho LeaveRequest.fromJson - phan doc leaveType (ham thuan tuy, khong goi mang).
import 'package:flutter_test/flutter_test.dart';

import 'package:ecap_mobile/models/leave_request.dart';

void main() {
  final base = {
    'id': 'a',
    'startDate': '2026-11-10',
    'endDate': '2026-11-10',
    'reason': 'Việc riêng',
    'status': 'PENDING',
  };

  test('doc leaveType tu JSON', () {
    expect(LeaveRequest.fromJson({...base, 'leaveType': 'SICK'}).leaveType, 'SICK');
  });

  test('thieu leaveType thi mac dinh ANNUAL, khong vo', () {
    expect(LeaveRequest.fromJson(base).leaveType, 'ANNUAL');
  });

  test('nhan tieng Viet, ma la thi giu nguyen ma', () {
    expect(leaveTypeLabelVi('SICK'), 'Nghỉ ốm');
    expect(leaveTypeLabelVi('XYZ'), 'XYZ');
  });
}
