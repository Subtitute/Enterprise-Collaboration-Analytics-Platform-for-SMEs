import { LeaveType, TIMESHEET_SYMBOL_VALUE, TimesheetSymbol } from '@app/common-dto';
import { CalendarBook, WorkScheduleRules, addDays, computeHoursPerDay, hhmmToMinutes } from '../work-calendar/work-calendar.util';

/**
 * 04/11/2026: phan thuan cua bang cong - khong dung toi DB, ket qua chi phu thuoc dau vao (ke ca `today`,
 * `now`) va khong phu thuoc mui gio may chu. Ket qua la JSON thuan (thoi diem dang chuoi ISO) nen luu thang
 * vao snapshot luc khoa ky va doc lai duoc nguyen ven.
 */
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
/** Ca tu ngan nay tro len moi tru gio nghi giua ca. */
const BREAK_FROM_HOURS = 5;

const LEAVE_SYMBOL: Record<LeaveType, TimesheetSymbol> = {
  [LeaveType.ANNUAL]: TimesheetSymbol.P,
  [LeaveType.SICK]: TimesheetSymbol.OM,
  [LeaveType.UNPAID]: TimesheetSymbol.KL,
};

export const TIMESHEET_EXCEPTION_TYPES = ['LATE', 'EARLY_LEAVE', 'ABSENT', 'MISSING_CHECKOUT', 'NOT_CHECKED_IN', 'OT_NO_ATTENDANCE'] as const;
export type TimesheetExceptionType = (typeof TIMESHEET_EXCEPTION_TYPES)[number];

export interface TimesheetUser {
  userId: string;
  departmentId: string | null;
  joinedAt: string | null;
}

export interface ComputeMonthInput {
  /** 'YYYY-MM'. */
  month: string;
  /** Hom nay theo GMT+7, 'YYYY-MM-DD'. */
  today: string;
  now: Date;
  /** Phai nap phu tron thang dang tinh. */
  book: CalendarBook;
  users: TimesheetUser[];
  attendances: Array<{ userId: string; workDate: string; checkInAt: Date | string; checkOutAt?: Date | string | null }>;
  /** Chi don da duyet. */
  leaves: Array<{ userId: string; startDate: string; endDate: string; leaveType: LeaveType }>;
  /** Chi lam them da duyet. */
  overtimes: Array<{ userId: string; workDate: string; otStart: string; otEnd: string; estimatedHours: number }>;
  entries: Array<{ userId: string; workDate: string; symbol: TimesheetSymbol; note: string }>;
}

export interface TimesheetDay {
  date: string;
  symbol: TimesheetSymbol | null;
  workValue: number;
  isWorkingDay: boolean;
  holidayName: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedHours: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  otHours: number;
  isManual: boolean;
  note: string | null;
}

export interface TimesheetRow extends TimesheetUser {
  actualDays: number;
  offDayWorkDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  paidHolidayDays: number;
  absentDays: number;
  paidDays: number;
  expectedDays: number;
  totalActualHours: number;
  totalExpectedHours: number;
  lateCount: number;
  earlyLeaveCount: number;
  missingCheckOutCount: number;
  otHours: number;
  approvedOtHours: number;
  hasManual: boolean;
  isNewMember: boolean;
  status: 'sufficient' | 'insufficient' | 'notJoined';
}

export interface TimesheetException {
  type: TimesheetExceptionType;
  userId: string;
  workDate: string;
  minutes?: number;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  otHours?: number;
}

export interface TimesheetUserMonth {
  row: TimesheetRow;
  days: TimesheetDay[];
  exceptions: TimesheetException[];
}

export interface TimesheetMonthResult {
  month: string;
  schedule: WorkScheduleRules & { hoursPerDay: number };
  /** So ngay lam viec cua ca thang, ke ca le roi vao ngay lam. */
  standardDays: number;
  users: TimesheetUserMonth[];
}

/** 'YYYY-MM' hop le, nam trong khoang hop ly - nam lech hon nhieu lam sai phep tinh Date.UTC. */
export function isValidMonth(month: unknown): month is string {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  const year = Number(month.slice(0, 4));
  return year >= 2000 && year <= 2100;
}

/** 'YYYY-MM-DD' la ngay co that. */
export function isValidDate(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function monthRange(month: string): { start: string; end: string } {
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` };
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
const pairKey = (userId: string, date: string): string => `${userId}|${date}`;
const toMs = (value: Date | string): number => new Date(value).getTime();
/** Thoi diem 00:00 GMT+7 cua 1 ngay - moi so sanh gio deu neo vao day, khong doc gio theo may chu. */
const dayStartMs = (date: string): number => Date.parse(`${date}T00:00:00+07:00`);
const minuteOfDay = (ms: number, date: string): number => Math.floor((ms - dayStartMs(date)) / MINUTE_MS);

function workedHoursOf(checkIn: number | null, checkOut: number | null, breakMinutes: number): number {
  if (checkIn === null || checkOut === null || checkOut <= checkIn) return 0;
  const hours = (checkOut - checkIn) / HOUR_MS;
  return hours >= BREAK_FROM_HOURS ? Math.max(0, hours - breakMinutes / 60) : hours;
}

/** Phan giao giua cac khung lam them da duyet va khoang vao-ra; khung chong nhau chi tinh 1 lan. */
function overtimeHoursOf(overtimes: ComputeMonthInput['overtimes'], date: string, checkIn: number | null, checkOut: number | null): number {
  if (checkIn === null || checkOut === null) return 0;
  const start = dayStartMs(date);
  const windows = overtimes
    .map((ot) => [start + hhmmToMinutes(ot.otStart) * MINUTE_MS, start + hhmmToMinutes(ot.otEnd) * MINUTE_MS])
    .sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let cursor = checkIn;
  for (const [windowStart, windowEnd] of windows) {
    const from = Math.max(windowStart, cursor);
    const to = Math.min(windowEnd, checkOut);
    if (to > from) covered += to - from;
    cursor = Math.max(cursor, windowEnd);
  }
  return covered / HOUR_MS;
}

/** Quy tac 2-6 cua thiet ke, theo dung thu tu; quy tac 1 (truoc ngay vao lam) va 7 (sua tay) xu ly o noi goi. */
function resolveAutoSymbol(book: CalendarBook, today: string, date: string, hasAttendance: boolean, hasCheckOut: boolean, leaveType?: LeaveType): TimesheetSymbol | null {
  if (book.holidayOf(date) && book.isScheduledWorkday(date)) return TimesheetSymbol.L;
  if (!book.isWorkingDay(date)) return hasAttendance ? TimesheetSymbol.LN : null;
  if (hasAttendance) return !hasCheckOut && date < today ? TimesheetSymbol.Q : TimesheetSymbol.X;
  if (leaveType) return LEAVE_SYMBOL[leaveType];
  return date < today ? TimesheetSymbol.V : null;
}

export function computeMonth(input: ComputeMonthInput): TimesheetMonthResult {
  const { month, today, now, book } = input;
  const { start, end } = monthRange(month);
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);

  const attendanceByKey = new Map(input.attendances.map((attendance) => [pairKey(attendance.userId, attendance.workDate), attendance]));
  const entryByKey = new Map(input.entries.map((entry) => [pairKey(entry.userId, entry.workDate), entry]));
  const overtimesByKey = new Map<string, ComputeMonthInput['overtimes']>();
  for (const overtime of input.overtimes) {
    const key = pairKey(overtime.userId, overtime.workDate);
    overtimesByKey.set(key, [...(overtimesByKey.get(key) ?? []), overtime]);
  }
  // Don vat qua thang chi lay phan trong thang dang tinh.
  const leaveByKey = new Map<string, LeaveType>();
  for (const leave of input.leaves) {
    const first = leave.startDate < start ? start : leave.startDate;
    const last = leave.endDate > end ? end : leave.endDate;
    for (let date = first; date <= last; date = addDays(date, 1)) {
      const key = pairKey(leave.userId, date);
      if (!leaveByKey.has(key)) leaveByKey.set(key, leave.leaveType);
    }
  }

  const { workStart, workEnd, lateGraceMinutes, earlyLeaveGraceMinutes, breakMinutes, workingWeekdays } = book.schedule;
  const workStartMinute = hhmmToMinutes(workStart);
  const workEndMinute = hhmmToMinutes(workEnd);
  const hoursPerDay = computeHoursPerDay(book.schedule);
  const todayMinute = minuteOfDay(now.getTime(), today);

  const users = input.users.map((user): TimesheetUserMonth => {
    const { userId, joinedAt } = user;
    const days: TimesheetDay[] = [];
    const exceptions: TimesheetException[] = [];
    const row: TimesheetRow = {
      ...user,
      actualDays: 0,
      offDayWorkDays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
      paidHolidayDays: 0,
      absentDays: 0,
      paidDays: 0,
      expectedDays: 0,
      totalActualHours: 0,
      totalExpectedHours: 0,
      lateCount: 0,
      earlyLeaveCount: 0,
      missingCheckOutCount: 0,
      otHours: 0,
      approvedOtHours: 0,
      hasManual: false,
      isNewMember: !!joinedAt && joinedAt > start && joinedAt <= end,
      status: 'insufficient',
    };
    let workedTotal = 0;
    let otTotal = 0;
    let approvedOtTotal = 0;

    for (const date of dates) {
      const day: TimesheetDay = {
        date,
        symbol: null,
        workValue: 0,
        isWorkingDay: book.isWorkingDay(date),
        holidayName: book.holidayOf(date)?.title ?? null,
        checkInAt: null,
        checkOutAt: null,
        workedHours: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        otHours: 0,
        isManual: false,
        note: null,
      };
      days.push(day);
      // Quy tac 1: truoc ngay vao lam khong co gi, ke ca du lieu con sot.
      if (joinedAt && date < joinedAt) continue;
      if (book.isScheduledWorkday(date)) row.expectedDays += 1;

      const key = pairKey(userId, date);
      const attendance = attendanceByKey.get(key);
      const leaveType = leaveByKey.get(key);
      const entry = entryByKey.get(key);
      const overtimes = overtimesByKey.get(key) ?? [];
      const checkIn = attendance ? toMs(attendance.checkInAt) : null;
      const checkOut = attendance?.checkOutAt ? toMs(attendance.checkOutAt) : null;
      const autoSymbol = resolveAutoSymbol(book, today, date, checkIn !== null, checkOut !== null, leaveType);

      if (checkIn !== null && (autoSymbol === TimesheetSymbol.X || autoSymbol === TimesheetSymbol.Q)) {
        day.lateMinutes = Math.max(0, minuteOfDay(checkIn, date) - workStartMinute - lateGraceMinutes);
      }
      if (checkOut !== null && autoSymbol === TimesheetSymbol.X) {
        day.earlyLeaveMinutes = Math.max(0, workEndMinute - minuteOfDay(checkOut, date) - earlyLeaveGraceMinutes);
      }
      // Quy tac 7: sua tay thay ky hieu va so cong; so do cham cong van giu, tru khi ky hieu moi khong phai di lam.
      day.symbol = entry ? entry.symbol : autoSymbol;
      day.workValue = day.symbol ? TIMESHEET_SYMBOL_VALUE[day.symbol] : 0;
      if (entry) {
        day.isManual = true;
        day.note = entry.note;
        row.hasManual = true;
        if (entry.symbol !== TimesheetSymbol.X && entry.symbol !== TimesheetSymbol.Q && entry.symbol !== TimesheetSymbol.LN) {
          day.lateMinutes = 0;
          day.earlyLeaveMinutes = 0;
        }
      }
      day.checkInAt = checkIn !== null ? new Date(checkIn).toISOString() : null;
      day.checkOutAt = checkOut !== null ? new Date(checkOut).toISOString() : null;

      const worked = workedHoursOf(checkIn, checkOut, breakMinutes);
      const ot = overtimeHoursOf(overtimes, date, checkIn, checkOut);
      day.workedHours = round1(worked);
      day.otHours = round1(ot);
      workedTotal += worked;
      otTotal += ot;
      approvedOtTotal += overtimes.reduce((sum, overtime) => sum + overtime.estimatedHours, 0);

      row.paidDays += day.workValue;
      if (day.symbol === TimesheetSymbol.X || day.symbol === TimesheetSymbol.Q) row.actualDays += 1;
      if (day.symbol === TimesheetSymbol.LN) row.offDayWorkDays += 1;
      if (day.symbol === TimesheetSymbol.P || day.symbol === TimesheetSymbol.OM) row.paidLeaveDays += 1;
      if (day.symbol === TimesheetSymbol.KL) row.unpaidLeaveDays += 1;
      if (day.symbol === TimesheetSymbol.L) row.paidHolidayDays += 1;
      if (day.symbol === TimesheetSymbol.V) row.absentDays += 1;
      if (day.symbol === TimesheetSymbol.Q) row.missingCheckOutCount += 1;
      if (day.lateMinutes > 0) row.lateCount += 1;
      if (day.earlyLeaveMinutes > 0) row.earlyLeaveCount += 1;

      const times = { checkInAt: day.checkInAt, checkOutAt: day.checkOutAt };
      if (day.lateMinutes > 0) exceptions.push({ type: 'LATE', userId, workDate: date, minutes: day.lateMinutes, ...times });
      if (day.earlyLeaveMinutes > 0) exceptions.push({ type: 'EARLY_LEAVE', userId, workDate: date, minutes: day.earlyLeaveMinutes, ...times });
      if (day.symbol === TimesheetSymbol.V) exceptions.push({ type: 'ABSENT', userId, workDate: date });
      if (day.symbol === TimesheetSymbol.Q) exceptions.push({ type: 'MISSING_CHECKOUT', userId, workDate: date, ...times });
      if (date === today && day.isWorkingDay && checkIn === null && !leaveType && !entry && todayMinute > workStartMinute + lateGraceMinutes) {
        exceptions.push({ type: 'NOT_CHECKED_IN', userId, workDate: date });
      }
      // Khung lam them chua ket thuc thi chua the coi la thieu cham cong.
      if (overtimes.length > 0 && checkOut === null) {
        const lastEnd = dayStartMs(date) + Math.max(...overtimes.map((overtime) => hhmmToMinutes(overtime.otEnd))) * MINUTE_MS;
        if (now.getTime() >= lastEnd) {
          exceptions.push({ type: 'OT_NO_ATTENDANCE', userId, workDate: date, otHours: round1(overtimes.reduce((sum, overtime) => sum + overtime.estimatedHours, 0)), ...times });
        }
      }
    }

    row.totalActualHours = round1(workedTotal);
    row.totalExpectedHours = round1(row.expectedDays * hoursPerDay);
    row.otHours = round1(otTotal);
    row.approvedOtHours = round1(approvedOtTotal);
    if (joinedAt && joinedAt > end) row.status = 'notJoined';
    else row.status = row.paidDays >= row.expectedDays ? 'sufficient' : 'insufficient';
    return { row, days, exceptions };
  });

  return {
    month,
    schedule: { workingWeekdays, workStart, workEnd, lateGraceMinutes, earlyLeaveGraceMinutes, breakMinutes, hoursPerDay },
    standardDays: dates.filter((date) => book.isScheduledWorkday(date)).length,
    users,
  };
}

/** Gom ngoai le cua nhieu nguoi: ngay giam dan, on dinh giua cac trang; `counts` khong phu thuoc bo loc loai. */
export function collectExceptions(users: TimesheetUserMonth[], type?: TimesheetExceptionType): { rows: TimesheetException[]; counts: Record<TimesheetExceptionType, number> } {
  const counts = Object.fromEntries(TIMESHEET_EXCEPTION_TYPES.map((key) => [key, 0])) as Record<TimesheetExceptionType, number>;
  const all = users.flatMap((user) => user.exceptions);
  for (const exception of all) counts[exception.type] += 1;
  const rows = (type ? all.filter((exception) => exception.type === type) : all).sort(
    (a, b) => b.workDate.localeCompare(a.workDate) || a.userId.localeCompare(b.userId) || a.type.localeCompare(b.type),
  );
  return { rows, counts };
}
