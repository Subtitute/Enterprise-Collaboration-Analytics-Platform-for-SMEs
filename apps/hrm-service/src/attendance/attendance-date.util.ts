const GMT7_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Quy doi 1 thoi diem (luu UTC trong DB, dung ClaudeRule.md muc 4 va quy uoc chung toan repo -
 * xem event-envelope.ts) sang chuoi ngay lam viec 'YYYY-MM-DD' THEO LICH GMT+7 (khong co DST tai
 * Viet Nam nen offset co dinh +7 gio la du chinh xac, khong can thu vien timezone).
 *
 * Dung de xac dinh "1 ban ghi cham cong/1 nguoi dung/1 ngay" (Attendance.workDate) - vd 23:30
 * ngay 04/08 gio GMT+7 la 16:30 UTC CUNG NGAY, nhung 00:30 ngay 05/08 gio GMT+7 la 17:30 UTC
 * ngay 04/08 - neu tinh "ngay" truc tiep tu UTC se sai lech 1 ngay vao khung gio 00:00-07:00 GMT+7.
 */
export function toGmt7DateString(date: Date): string {
  const shifted = new Date(date.getTime() + GMT7_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}
