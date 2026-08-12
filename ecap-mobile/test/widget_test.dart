// Test don vi cho cac ham thuan tuy (khong goi mang/plugin nen tin cay trong CI/local) - test
// widget day du (dang nhap, cham cong...) can mock Dio + path_provider, de lai cho ban mo rong
// sau (Doc/ECAP_Mobile.md).
import 'package:flutter_test/flutter_test.dart';

import 'package:ecap_mobile/core/date_format.dart';
import 'package:ecap_mobile/models/leave_request.dart';

void main() {
  test('todayGmt7DateString tra ve dung dinh dang YYYY-MM-DD', () {
    final result = todayGmt7DateString();
    expect(RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(result), isTrue);
  });

  test('leaveRequestStatusLabelVi anh xa dung nhan tieng Viet', () {
    expect(leaveRequestStatusLabelVi(LeaveRequestStatus.pending), 'Chờ duyệt');
    expect(leaveRequestStatusLabelVi(LeaveRequestStatus.approved), 'Đã duyệt');
    expect(leaveRequestStatusLabelVi(LeaveRequestStatus.rejected), 'Đã từ chối');
  });
}
