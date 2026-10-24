// 24/10/2026: quy doi thoi diem sang lich GMT+7 (ClaudeRule.md muc 4) - mirror
// apps/hrm-service/src/attendance/attendance-date.util.ts (Viet Nam khong co DST nen offset co dinh
// +7 gio la du chinh xac, khong can thu vien timezone). Dung cho: ngay dem tran cau hoi/ngay, "hom
// nay" cua tool cham cong, va gio hien thi trong ket qua tool (model khong phai tu doi mui gio).
const GMT7_OFFSET_MS = 7 * 60 * 60 * 1000;

function shift(date: Date): string {
  return new Date(date.getTime() + GMT7_OFFSET_MS).toISOString();
}

/** 'YYYY-MM-DD' theo lich GMT+7. */
export function toGmt7DateString(date: Date): string {
  return shift(date).slice(0, 10);
}

/** 'HH:mm' theo gio GMT+7. */
export function toGmt7TimeString(date: Date): string {
  return shift(date).slice(11, 16);
}

/** 'DD/MM/YYYY HH:mm' theo gio GMT+7 - dua vao system prompt de model biet "hom nay" la ngay nao. */
export function toGmt7Label(date: Date): string {
  const iso = shift(date);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`;
}
