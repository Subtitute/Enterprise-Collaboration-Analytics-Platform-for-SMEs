import { LEAVE_TYPE_RULES, LeaveRequestStatus, LeaveType } from '@app/common-dto';
import { CalendarBook, countWorkingDaysInYear } from '../work-calendar/work-calendar.util';

/** 04/11/2026: phan thuan cua so du phep nam, tach khoi DB de test du cac truong hop bien. */
export interface YearBalance {
  year: number;
  usedDays: number;
  pendingDays: number;
  adjustmentDays: number;
  seniorityBonusDays: number;
  entitledDays: number;
  /** thuc huong - da duyet - dang cho; co the am neu chinh sach bi giam hoac bi dieu chinh am. */
  remainingDays: number;
}

export interface BalanceRequest {
  id?: string;
  startDate: string;
  endDate: string;
  status: LeaveRequestStatus;
  leaveType: LeaveType;
}

export interface LeavePolicyRules {
  baseDaysPerYear: number;
  seniorityYearsPerBonusDay: number;
}

/**
 * Phep tham nien cua nam `year`: so nam lam tron tinh toi moc = hom nay, keo ve trong nam dang xet (nam da
 * qua tinh toi 31/12, nam sau tinh toi 01/01) - nam hien tai khop dung so nguoi dung thay, va 1 don vat qua
 * giao thua van co so xac dinh cho tung nam. Khong co joinedAt thi tham nien = 0.
 */
export function computeSeniorityBonusDays(joinedAt: string | null | undefined, year: number, today: string, yearsPerBonusDay: number): number {
  if (!joinedAt || yearsPerBonusDay <= 0) return 0;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const asOf = today < yearStart ? yearStart : today > yearEnd ? yearEnd : today;
  let years = Number(asOf.slice(0, 4)) - Number(joinedAt.slice(0, 4));
  if (asOf.slice(5) < joinedAt.slice(5)) years -= 1;
  return Math.floor(Math.max(0, years) / yearsPerBonusDay);
}

/** `excludeRequestId`: don dang duoc xet (luc duyet) khong tinh vao "dang cho" de khoi dem 2 lan. */
export function computeYearBalance(input: {
  year: number;
  today: string;
  joinedAt?: string | null;
  policy: LeavePolicyRules;
  adjustmentDays: number;
  requests: BalanceRequest[];
  book: Pick<CalendarBook, 'isWorkingDay'>;
  excludeRequestId?: string;
}): YearBalance {
  let usedDays = 0;
  let pendingDays = 0;
  for (const request of input.requests) {
    if (request.id !== undefined && request.id === input.excludeRequestId) continue;
    if (!LEAVE_TYPE_RULES[request.leaveType].deductsBalance) continue;
    const days = countWorkingDaysInYear(input.book, request.startDate, request.endDate, input.year);
    if (request.status === LeaveRequestStatus.APPROVED) usedDays += days;
    else if (request.status === LeaveRequestStatus.PENDING) pendingDays += days;
  }
  const seniorityBonusDays = computeSeniorityBonusDays(input.joinedAt, input.year, input.today, input.policy.seniorityYearsPerBonusDay);
  const entitledDays = input.policy.baseDaysPerYear + seniorityBonusDays + input.adjustmentDays;
  return {
    year: input.year,
    usedDays,
    pendingDays,
    adjustmentDays: input.adjustmentDays,
    seniorityBonusDays,
    entitledDays,
    remainingDays: entitledDays - usedDays - pendingDays,
  };
}
