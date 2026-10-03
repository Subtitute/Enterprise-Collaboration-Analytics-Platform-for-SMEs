import { PERMISSIONS } from '@app/common-dto';

/**
 * 03/10/2026: "cap do tham quyen lich" cua 1 nguoi goi - dung CA luc TAO (chot vao
 * CalendarEvent.createdByRank) LAN luc KIEM TRA quyen SUA/XOA (CalendarEventsService), de dam bao
 * 2 noi dung 1 cach tinh DUY NHAT. Tinh tu PERMISSION hien co cua nguoi goi, KHONG tu ten vai tro
 * (DefaultRoleName) - du 3 muc nay tren thuc te khop voi 3 vai tro mac dinh (Org Admin/Manager/
 * Employee), gate theo TEN vai tro la 1 loai loi da gap lai nhieu lan (xem
 * Doc/RevisionHistory.md 17/09/2026) nen co tinh tranh hoan toan o day.
 *
 * 3 = giu PERMISSIONS.ORG_MANAGE (quyen quan tri to chuc, hien chi Org Admin co qua
 * DEFAULT_ROLE_PERMISSIONS.ORG_ADMIN = toan bo permission he thong).
 * 2 = giu PERMISSIONS.CALENDAR_MANAGE nhung khong giu ORG_MANAGE (Manager).
 * 1 = con lai (Employee).
 */
export function computeCallerCalendarRank(permissions: string[]): number {
  if (permissions.includes(PERMISSIONS.ORG_MANAGE)) return 3;
  if (permissions.includes(PERMISSIONS.CALENDAR_MANAGE)) return 2;
  return 1;
}
