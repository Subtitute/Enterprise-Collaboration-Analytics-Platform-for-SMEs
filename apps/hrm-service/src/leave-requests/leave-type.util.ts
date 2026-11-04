import { LeaveType } from '@app/common-dto';

/**
 * 04/11/2026: truoc khi co cot leave_type, loai nghi nam trong tien to cua `reason` (`[SICK] ...`, nhan
 * cu `[Nghi om] ...`, nhan tieng Anh/Nhat). Cu phap regex nay dung chung cho JS va Postgres (`~*`) de
 * suy loai luc tao don va backfill du lieu cu cho cung ket qua. Chi khop o DAU chuoi: ly do chi nhac toi
 * chu "om" o giua cau khong phai la tien to.
 */
export const LEGACY_REASON_PATTERNS: ReadonlyArray<{ leaveType: LeaveType; source: string }> = [
  { leaveType: LeaveType.SICK, source: '^\\s*(\\[\\s*SICK\\s*\\]|\\[\\s*Nghỉ ốm|\\[?\\s*Sick leave|\\[?\\s*病気休暇)' },
  { leaveType: LeaveType.UNPAID, source: '^\\s*(\\[\\s*UNPAID\\s*\\]|\\[\\s*Nghỉ việc riêng|\\[?\\s*Personal leave|\\[?\\s*私用休暇)' },
];

/** Khong co tien to thi la phep nam - dung gia tri mac dinh cua cot leave_type. */
export function inferLeaveTypeFromReason(reason: string): LeaveType {
  const match = LEGACY_REASON_PATTERNS.find(({ source }) => new RegExp(source, 'i').test(reason));
  return match ? match.leaveType : LeaveType.ANNUAL;
}
