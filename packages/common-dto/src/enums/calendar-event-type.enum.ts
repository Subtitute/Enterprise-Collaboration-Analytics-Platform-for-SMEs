/**
 * 15/09/2026: loai muc lich cong ty (HRM-lite mo rong, theo yeu cau GVHD - xem
 * Technical_Spec.md "Lich cong ty"). HOLIDAY = ngay le/nghi le chinh thuc cua to chuc (vd Tet,
 * 30/4...), EVENT = su kien/dat lich noi bo khac (hop toan cong ty, dao tao...). Chi 2 loai -
 * du dung cho pham vi da thong nhat, khong them phan loai con de giu toi gian (ClaudeRule.md
 * muc 8).
 */
export enum CalendarEventType {
  HOLIDAY = 'HOLIDAY',
  EVENT = 'EVENT',
}
