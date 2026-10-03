// 03/10/2026: unit test cho leaveDetection.ts - truyen `todayGmt7` co dinh ('2026-10-01', mot thu
// Nam) cho moi ca co lien quan den ngay tuong doi/thu trong tuan, de ket qua tat dinh va khong phu
// thuoc ngay chay test that su (mirror tinh than cua utils.test.ts: ep moi truong test ve 1 moc co
// the kiem chung bang tay thay vi dua vao "may chay test tinh co dung").
import { describe, it, expect } from 'vitest';
import { detectLeaveIntent } from './leaveDetection';

const TODAY = '2026-10-01'; // Thu Nam, 01/10/2026

describe('detectLeaveIntent', () => {
  it('nhan dien ngay tuyet doi dd/mm (khong nam) - mac dinh lay nam hien tai', () => {
    expect(detectLeaveIntent('Cho tôi xin nghỉ ngày 15/10 nhé', TODAY)).toEqual({ resolvedDate: '2026-10-15' });
  });

  it('nhan dien ngay tuyet doi dd/mm/yyyy', () => {
    expect(detectLeaveIntent('Tôi xin nghỉ phép ngày 15/10/2026', TODAY)).toEqual({ resolvedDate: '2026-10-15' });
  });

  it('nhan dien "ngày X tháng Y" (khong nam) va co "năm Z"', () => {
    expect(detectLeaveIntent('Cho em xin nghỉ ngày 15 tháng 10 ạ', TODAY)).toEqual({ resolvedDate: '2026-10-15' });
    expect(detectLeaveIntent('Xin nghỉ ngày 15 tháng 10 năm 2027', TODAY)).toEqual({ resolvedDate: '2027-10-15' });
  });

  it('nhan dien "hôm nay"', () => {
    expect(detectLeaveIntent('Hôm nay tôi bị ốm, xin nghỉ', TODAY)).toEqual({ resolvedDate: '2026-10-01' });
  });

  it('nhan dien "ngày mai" va "mai" dung doc lap (+1 ngay)', () => {
    expect(detectLeaveIntent('Ngày mai tôi xin nghỉ', TODAY)).toEqual({ resolvedDate: '2026-10-02' });
    expect(detectLeaveIntent('Mai mình xin nghỉ nhé sếp', TODAY)).toEqual({ resolvedDate: '2026-10-02' });
  });

  it('nhan dien "ngày mốt" va "ngày kia" (+2 ngay)', () => {
    expect(detectLeaveIntent('Ngày mốt tôi xin nghỉ', TODAY)).toEqual({ resolvedDate: '2026-10-03' });
    expect(detectLeaveIntent('Ngày kia tôi xin nghỉ', TODAY)).toEqual({ resolvedDate: '2026-10-03' });
  });

  it('nhan dien thu trong tuan KHONG kem "tuần..." - mac dinh la lan xay ra gan nhat sap toi', () => {
    // TODAY la Thu Nam (01/10) - "Thứ Ba" gan nhat sap toi la 06/10.
    expect(detectLeaveIntent('Thứ Ba tôi xin nghỉ', TODAY)).toEqual({ resolvedDate: '2026-10-06' });
  });

  it('nhan dien thu trong tuan kem "tuần này" - co the la 1 ngay da qua trong tuan hien tai', () => {
    // TODAY la Thu Nam (01/10) cua tuan co Thu Hai la 28/09.
    expect(detectLeaveIntent('Thứ Hai tuần này tôi xin nghỉ', TODAY)).toEqual({ resolvedDate: '2026-09-28' });
  });

  it('nhan dien thu trong tuan kem "tuần sau"/"tuần tới" - cong them 1 tuan', () => {
    expect(detectLeaveIntent('Thứ Hai tuần sau tôi xin nghỉ', TODAY)).toEqual({ resolvedDate: '2026-10-05' });
    expect(detectLeaveIntent('Chủ nhật tuần tới tôi xin nghỉ', TODAY)).toEqual({ resolvedDate: '2026-10-11' });
  });

  it('nhan dien offset tuong doi "N ngày nữa/tới/sau" va "N tuần nữa/tới/sau"', () => {
    expect(detectLeaveIntent('3 ngày nữa tôi xin nghỉ', TODAY)).toEqual({ resolvedDate: '2026-10-04' });
    expect(detectLeaveIntent('2 tuần nữa tôi xin nghỉ', TODAY)).toEqual({ resolvedDate: '2026-10-15' });
  });

  it('chi khop gio/khoang thoi gian (khong co ngay cu the) - mac dinh resolvedDate la HOM NAY', () => {
    expect(detectLeaveIntent('Tôi xin nghỉ lúc 14:30', TODAY)).toEqual({ resolvedDate: TODAY });
    expect(detectLeaveIntent('Tôi xin nghỉ 2h chiều nay', TODAY)).toEqual({ resolvedDate: TODAY });
    expect(detectLeaveIntent('Tôi xin nghỉ lúc 14 giờ', TODAY)).toEqual({ resolvedDate: TODAY });
    expect(detectLeaveIntent('Cho tôi xin nghỉ khoảng 2 tiếng', TODAY)).toEqual({ resolvedDate: TODAY });
    expect(detectLeaveIntent('Tôi xin ra ngoài 30 phút', TODAY)).toEqual({ resolvedDate: TODAY });
  });

  it('khong phan biet hoa/thuong (da chuan hoa qua removeVietnameseTones)', () => {
    expect(detectLeaveIntent('NGÀY MAI TÔI XIN NGHỈ', TODAY)).toEqual({ resolvedDate: '2026-10-02' });
  });

  it('khong khop "mai" khi no nam BEN TRONG 1 tu khac (khong phai dung doc lap)', () => {
    expect(detectLeaveIntent('Tôi đang dùng điện thoại samaisung đời mới', TODAY)).toBeNull();
  });

  it('KHONG khop: cau hoi tham/chuyen tro thong thuong, khong co ngay/gio nao', () => {
    expect(detectLeaveIntent('Chúc mọi người một ngày làm việc hiệu quả.', TODAY)).toBeNull();
  });

  it('KHONG khop: cam on thong thuong, khong co ngay/gio nao', () => {
    expect(detectLeaveIntent('Cảm ơn bạn rất nhiều vì đã giúp đỡ mình hôm trước nhé.', TODAY)).toBeNull();
  });

  it('tra ve null voi chuoi rong/chi khoang trang', () => {
    expect(detectLeaveIntent('', TODAY)).toBeNull();
    expect(detectLeaveIntent('   ', TODAY)).toBeNull();
  });
});
