// Test don vi cho cac ham thuan tuy (khong goi mang/plugin nen tin cay trong CI/local) - test
// widget day du (dang nhap, cham cong...) can mock Dio + path_provider, de lai cho ban mo rong
// sau (Doc/ECAP_Mobile.md).
import 'package:flutter_test/flutter_test.dart';

import 'package:ecap_mobile/core/date_format.dart';
import 'package:ecap_mobile/models/leave_request.dart';
import 'package:ecap_mobile/models/conversation.dart';
import 'package:ecap_mobile/models/message.dart';

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

  group('unreadBadgeLabel (Nhan tin)', () {
    test('an badge (chuoi rong) khi da doc het', () {
      expect(unreadBadgeLabel(0), '');
      expect(unreadBadgeLabel(-1), ''); // phong thu - khong bao gio xay ra thuc te nhung khong duoc hien so am
    });

    test('hien dung so khi con it hon 100 tin chua doc', () {
      expect(unreadBadgeLabel(1), '1');
      expect(unreadBadgeLabel(99), '99');
    });

    test('gioi han "99+" thay vi 1 con so dai lam vo bo cuc danh sach', () {
      expect(unreadBadgeLabel(100), '99+');
      expect(unreadBadgeLabel(1000), '99+');
    });
  });

  group('insertMessageSorted (man hinh chat)', () {
    final t0 = DateTime.utc(2026, 9, 28, 10, 0, 0);
    Message msg(String id, DateTime createdAt) =>
        Message(id: id, conversationId: 'c1', senderId: 'u1', body: 'noi dung $id', createdAt: createdAt);

    test('chen dung vi tri de giu thu tu TANG DAN theo createdAt', () {
      final existing = [msg('1', t0), msg('3', t0.add(const Duration(minutes: 2)))];
      final result = insertMessageSorted(existing, msg('2', t0.add(const Duration(minutes: 1))));
      expect(result.map((m) => m.id).toList(), ['1', '2', '3']);
    });

    test('loai trung theo id - tin nhan da co (vd tu ca REST lan WebSocket cung goi ve) khong duoc them lai', () {
      final existing = [msg('1', t0), msg('2', t0.add(const Duration(minutes: 1)))];
      final result = insertMessageSorted(existing, msg('2', t0.add(const Duration(minutes: 1))));
      expect(result.length, 2);
    });

    test('tin nhan moi den sau cung duoc noi vao cuoi danh sach', () {
      final existing = [msg('1', t0)];
      final result = insertMessageSorted(existing, msg('2', t0.add(const Duration(minutes: 5))));
      expect(result.map((m) => m.id).toList(), ['1', '2']);
    });
  });

  group('conversationDisplayTitle (danh sach hoi thoai/man hinh chat)', () {
    test('GROUP luon dung ten nhom that, khong phu thuoc nameFor', () {
      final group = Conversation(
        id: 'g1',
        type: ConversationType.group,
        name: 'Nhóm Dự án A',
        participantUserIds: ['u1', 'u2', 'u3'],
        lastMessage: null,
        unreadCount: 0,
      );
      final title = conversationDisplayTitle(group, selfUserId: 'u1', nameFor: (_) => 'KHONG DUNG TOI');
      expect(title, 'Nhóm Dự án A');
    });

    test('DIRECT suy ra tieu de tu ten NGUOI CON LAI (khong phai chinh minh)', () {
      final direct = Conversation(
        id: 'd1',
        type: ConversationType.direct,
        name: null,
        participantUserIds: ['u1', 'u2'],
        lastMessage: null,
        unreadCount: 0,
      );
      final title = conversationDisplayTitle(
        direct,
        selfUserId: 'u1',
        nameFor: (id) => id == 'u2' ? 'Nguyễn Văn B' : 'SAI',
      );
      expect(title, 'Nguyễn Văn B');
    });
  });
}
