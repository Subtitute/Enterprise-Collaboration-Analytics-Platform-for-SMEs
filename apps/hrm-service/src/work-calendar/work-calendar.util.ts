import { CalendarEventType } from '@app/common-dto';

/**
 * 04/11/2026: phan thuan cua lich lam viec (khong dung toi DB, khong phu thuoc mui gio may chu). Ngay luon
 * la chuoi 'YYYY-MM-DD' theo lich GMT+7; phep tinh ngay/thu lam bang UTC nen ket qua nhu nhau tren moi may.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_MINUTES = 240;

function toUtcMs(date: string): number {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Chu nhat ... 6 = Thu 7. */
export function weekdayOf(date: string): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

/** So ngay trong khoang, tinh ca 2 dau mut. */
export function daysInclusive(startDate: string, endDate: string): number {
  return Math.round((toUtcMs(endDate) - toUtcMs(startDate)) / DAY_MS) + 1;
}

/** Cac nam ma khoang ngay cham toi - don nghi vat qua giao thua tra ve 2 nam. */
export function yearsInRange(startDate: string, endDate: string): number[] {
  const years: number[] = [];
  for (let year = Number(startDate.slice(0, 4)); year <= Number(endDate.slice(0, 4)); year++) years.push(year);
  return years;
}

/** Moi thang ma khoang ngay cham toi lay 1 ngay dai dien - du cho PeriodLockService.assertOpen(). */
export function monthProbes(startDate: string, endDate: string): string[] {
  const probes = [startDate];
  let year = Number(startDate.slice(0, 4));
  let month = Number(startDate.slice(5, 7));
  for (;;) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    if (firstOfMonth > endDate) return probes;
    probes.push(firstOfMonth);
  }
}

export interface WorkScheduleRules {
  workingWeekdays: number[];
  workStart: string;
  workEnd: string;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  breakMinutes: number;
}

export function hhmmToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function computeHoursPerDay(schedule: Pick<WorkScheduleRules, 'workStart' | 'workEnd' | 'breakMinutes'>): number {
  return (hhmmToMinutes(schedule.workEnd) - hhmmToMinutes(schedule.workStart) - schedule.breakMinutes) / 60;
}

/** Tra ve thong bao loi tieng Viet neu lich khong hop le, null neu hop le. */
export function findWorkScheduleError(schedule: WorkScheduleRules): string | null {
  const weekdays = schedule.workingWeekdays;
  if (
    !Array.isArray(weekdays) ||
    weekdays.length === 0 ||
    !weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) ||
    new Set(weekdays).size !== weekdays.length
  ) {
    return 'Ngày làm việc trong tuần phải có ít nhất một ngày, nhận giá trị từ 0 đến 6 và không trùng nhau';
  }
  for (const value of [schedule.workStart, schedule.workEnd]) {
    if (typeof value !== 'string' || !HHMM_RE.test(value)) return 'Giờ làm việc phải có dạng HH:mm';
  }
  if (hhmmToMinutes(schedule.workEnd) <= hhmmToMinutes(schedule.workStart)) return 'Giờ kết thúc phải sau giờ bắt đầu';
  for (const value of [schedule.lateGraceMinutes, schedule.earlyLeaveGraceMinutes, schedule.breakMinutes]) {
    if (!Number.isInteger(value) || value < 0 || value > MAX_MINUTES) return `Số phút gia hạn và nghỉ giữa giờ phải từ 0 đến ${MAX_MINUTES}`;
  }
  if (computeHoursPerDay(schedule) <= 0) return 'Giờ nghỉ phải ngắn hơn ca làm việc';
  return null;
}

export interface CalendarBookEvent {
  type: CalendarEventType;
  title: string;
  startDate: string;
  endDate: string;
}

export interface HolidayEntry {
  date: string;
  title: string;
}

/** Bo tra cuu ngay, chi dung cho cac ngay trong khoang [from, to] da nap su kien. */
export interface CalendarBook {
  schedule: WorkScheduleRules;
  /** Ngay phai di lam that su: le thang tat ca, lam bu bien ngay nghi tuan thanh ngay lam, con lai theo tuan. */
  isWorkingDay(date: string): boolean;
  /** Ngay nam trong lich lam (theo tuan hoac lam bu), khong xet le - de phan biet le roi vao ngay lam voi le roi vao ngay nghi. */
  isScheduledWorkday(date: string): boolean;
  holidayOf(date: string): HolidayEntry | null;
  isMakeup(date: string): boolean;
}

export function buildCalendarBook(schedule: WorkScheduleRules, events: CalendarBookEvent[], from: string, to: string): CalendarBook {
  const holidays = new Map<string, string>();
  const makeups = new Set<string>();
  for (const event of events) {
    if (event.type !== CalendarEventType.HOLIDAY && event.type !== CalendarEventType.MAKEUP_WORKDAY) continue;
    const first = event.startDate < from ? from : event.startDate;
    const last = event.endDate > to ? to : event.endDate;
    for (let date = first; date <= last; date = addDays(date, 1)) {
      if (event.type === CalendarEventType.MAKEUP_WORKDAY) makeups.add(date);
      else if (!holidays.has(date)) holidays.set(date, event.title);
    }
  }

  const weekly = new Set(schedule.workingWeekdays);
  const isScheduledWorkday = (date: string) => makeups.has(date) || weekly.has(weekdayOf(date));
  return {
    schedule,
    isScheduledWorkday,
    isWorkingDay: (date) => !holidays.has(date) && isScheduledWorkday(date),
    holidayOf: (date) => {
      const title = holidays.get(date);
      return title === undefined ? null : { date, title };
    },
    isMakeup: (date) => makeups.has(date),
  };
}

export function countWorkingDays(book: Pick<CalendarBook, 'isWorkingDay'>, startDate: string, endDate: string): number {
  let count = 0;
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    if (book.isWorkingDay(date)) count++;
  }
  return count;
}

/** So ngay lam viec cua rieng phan khoang nam trong `year` - don vat qua giao thua tru vao dung tung nam. */
export function countWorkingDaysInYear(book: Pick<CalendarBook, 'isWorkingDay'>, startDate: string, endDate: string, year: number): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  return countWorkingDays(book, startDate < yearStart ? yearStart : startDate, endDate > yearEnd ? yearEnd : endDate);
}

/** Moi ngay le trong khoang, ke ca le roi vao ngay nghi tuan. */
export function listHolidays(book: Pick<CalendarBook, 'holidayOf'>, startDate: string, endDate: string): HolidayEntry[] {
  const holidays: HolidayEntry[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const holiday = book.holidayOf(date);
    if (holiday) holidays.push(holiday);
  }
  return holidays;
}
