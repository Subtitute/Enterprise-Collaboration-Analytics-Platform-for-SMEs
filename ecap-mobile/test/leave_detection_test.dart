// Test don vi cho detectLeaveIntent() (lib/features/messaging/leave_detection.dart) - ham THUAN
// TUY (khong goi mang/plugin), theo dung phong cach test/widget_test.dart. Day cung la tai lieu
// doi chieu voi ban apps/web dang xay CUNG LUC theo CUNG 1 bo quy tac (khac ngon ngu nen khong the
// dung chung code - xem chu thich dau leave_detection.dart).
import 'package:flutter_test/flutter_test.dart';

import 'package:ecap_mobile/features/messaging/leave_detection.dart';

void main() {
  // Co dinh "hom nay" = Thu Hai 28/09/2026 (khong co y nghia dac biet, chi tien tinh toan bang tay)
  // de ket qua test KHONG phu thuoc dong ho that cua may chay test.
  final today = DateTime(2026, 9, 28);

  group('detectLeaveIntent - tung loai mau hinh phai khop (yeu cau tinh nang)', () {
    test('ngay tuyet doi dd/mm/yyyy', () {
      final result = detectLeaveIntent('Cho em xin nghi ngay 15/10/2026 nhe', todayGmt7: today);
      expect(result.matched, isTrue);
      expect(result.resolvedDate, DateTime(2026, 10, 15));
    });

    test('ngay tuyet doi dd/mm (khong co nam - mac dinh lay nam hien tai)', () {
      final result = detectLeaveIntent('Em xin nghi 15/10 a', todayGmt7: today);
      expect(result.matched, isTrue);
      expect(result.resolvedDate, DateTime(2026, 10, 15));
    });

    test('"ngay X thang Y nam Z" (co dau)', () {
      final result = detectLeaveIntent('Tôi muốn xin nghỉ vào ngày 20 tháng 11 năm 2027', todayGmt7: today);
      expect(result.matched, isTrue);
      expect(result.resolvedDate, DateTime(2027, 11, 20));
    });

    test('"ngay X thang Y" khong dau, khong co nam - mac dinh lay nam hien tai', () {
      final result = detectLeaveIntent('xin nghi ngay 20 thang 11 nhe', todayGmt7: today);
      expect(result.resolvedDate, DateTime(2026, 11, 20));
    });

    test('tu ngay quan he "hom nay"', () {
      final result = detectLeaveIntent('Hôm nay em bị ốm, xin phép nghỉ', todayGmt7: today);
      expect(result.matched, isTrue);
      expect(result.resolvedDate, today);
    });

    test('tu ngay quan he "ngay mai" / "mai" dung mot minh', () {
      expect(detectLeaveIntent('Ngày mai em xin nghỉ phép', todayGmt7: today).resolvedDate,
          today.add(const Duration(days: 1)));
      expect(detectLeaveIntent('Mai em xin nghi phep nhe sep', todayGmt7: today).resolvedDate,
          today.add(const Duration(days: 1)));
    });

    test('tu ngay quan he "ngay mot" / "ngay kia" (= ngay sau ngay mai)', () {
      expect(detectLeaveIntent('Ngày mốt em xin nghỉ', todayGmt7: today).resolvedDate,
          today.add(const Duration(days: 2)));
      expect(detectLeaveIntent('Ngày kia em xin nghỉ', todayGmt7: today).resolvedDate,
          today.add(const Duration(days: 2)));
    });

    test('thu trong tuan, khong neu ro tuan nao (28/09/2026 la Thu Hai)', () {
      // Thu Sau gan nhat ke tu Thu Hai la +4 ngay.
      final result = detectLeaveIntent('Cho em xin nghi thu Sau nhe', todayGmt7: today);
      expect(result.matched, isTrue);
      expect(result.resolvedDate, today.add(const Duration(days: 4)));
    });

    test('chu nhat tuan sau (+6 ngay cho chu nhat gan nhat, cong them 7 ngay vi la "tuan sau")', () {
      final result = detectLeaveIntent('Xin nghi chu nhat tuan sau', todayGmt7: today);
      expect(result.resolvedDate, today.add(const Duration(days: 13)));
    });

    test('offset tuong doi theo ngay - "N ngay nua/toi/sau"', () {
      expect(detectLeaveIntent('3 ngay nua em xin nghi', todayGmt7: today).resolvedDate,
          today.add(const Duration(days: 3)));
      expect(detectLeaveIntent('xin nghi 5 ngày tới', todayGmt7: today).resolvedDate,
          today.add(const Duration(days: 5)));
    });

    test('offset tuong doi theo tuan - "N tuan nua/toi/sau"', () {
      expect(detectLeaveIntent('2 tuan nua cho em xin nghi', todayGmt7: today).resolvedDate,
          today.add(const Duration(days: 14)));
    });

    test('gio/thoi luong, khong kem ngay cu the - mac dinh ngay = hom nay', () {
      expect(detectLeaveIntent('Hop luc 2h chieu nay', todayGmt7: today).resolvedDate, today);
      expect(detectLeaveIntent('Bận rộn từ 14 giờ', todayGmt7: today).resolvedDate, today);
      expect(detectLeaveIntent('Hẹn gặp lúc 14:30', todayGmt7: today).resolvedDate, today);
      expect(detectLeaveIntent('Chi mat khoang 2 tieng thoi', todayGmt7: today).resolvedDate, today);
      expect(detectLeaveIntent('Nghi tam 30 phut', todayGmt7: today).resolvedDate, today);
    });
  });

  group('detectLeaveIntent - khong khop (sanity)', () {
    test('tin nhan hoan toan khong nhac den thoi gian/ngay thang', () {
      final result = detectLeaveIntent('Dự án tiến triển rất tốt, cảm ơn cả team đã hỗ trợ', todayGmt7: today);
      expect(result.matched, isFalse);
      expect(result.resolvedDate, isNull);
    });

    test('"mai" nam BEN TRONG 1 tu khac (vd "email") khong duoc tinh la tu doc lap "mai"', () {
      final result = detectLeaveIntent('Anh check email giúp em cái nhé', todayGmt7: today);
      expect(result.matched, isFalse);
    });
  });
}
