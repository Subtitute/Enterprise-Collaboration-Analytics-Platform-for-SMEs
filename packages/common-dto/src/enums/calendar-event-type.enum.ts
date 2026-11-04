/**
 * 15/09/2026: loai muc lich cong ty (HRM-lite mo rong, theo yeu cau GVHD - xem
 * Technical_Spec.md "Lich cong ty"). HOLIDAY = ngay le/nghi le chinh thuc cua to chuc (vd Tet,
 * 30/4...), EVENT = su kien/dat lich noi bo khac (hop toan cong ty, dao tao...). Chi 2 loai -
 * du dung cho pham vi da thong nhat, khong them phan loai con de giu toi gian (ClaudeRule.md
 * muc 8).
 *
 * 04/11/2026: them MAKEUP_WORKDAY = ngay lam bu, bien 1 ngay nghi trong tuan thanh ngay lam viec (xem
 * work-calendar cua hrm-service). Le van thang neu trung ngay.
 */
export enum CalendarEventType {
  HOLIDAY = 'HOLIDAY',
  EVENT = 'EVENT',
  MAKEUP_WORKDAY = 'MAKEUP_WORKDAY',
}
