/**
 * Dem so ngay lam viec (Thu 2 - Thu 6) trong 1 khoang ngay dong 'YYYY-MM-DD' (bao gom ca 2 dau
 * mut). KHONG loai tru ngay le cong ty (CalendarEvent HOLIDAY) - gioi han da biet, chap nhan cho
 * MVP nay (mirror dung heuristic da dung o MonthlyTimesheetTable.tsx/calculateWorkingDays()
 * apps/web/src/lib/utils.ts, giu nhat quan "so ngay" hien thi giua cac man hinh).
 */
export function countWorkingDaysInclusive(startDateStr: string, endDateStr: string): number {
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dayOfWeek = cur.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
