import { CalendarEventType, LeaveType, TimesheetSymbol } from '@app/common-dto';
import { CalendarBookEvent, WorkScheduleRules, buildCalendarBook } from '../work-calendar/work-calendar.util';
import { ComputeMonthInput, TimesheetExceptionType, collectExceptions, computeMonth, isValidDate, isValidMonth, monthRange } from './timesheet-calculator';

/**
 * 04/11/2026: xem timesheet-calculator.ts. Thang mau 10/2026: 01/10 la Thu 5, Thu 7 la 03-10-17-24-31, Chu
 * nhat la 04-11-18-25, co 22 ngay Thu 2 - Thu 6. Khong khai bao gi them thi coi nhu thang da qua.
 */
describe('timesheet-calculator', () => {
  const MONTH = '2026-10';
  const USER = 'user-1';
  const schedule: WorkScheduleRules = { workingWeekdays: [1, 2, 3, 4, 5], workStart: '08:30', workEnd: '17:30', lateGraceMinutes: 0, earlyLeaveGraceMinutes: 0, breakMinutes: 60 };
  /** Thoi diem theo gio GMT+7, ket qua khong phu thuoc mui gio may chay test. */
  const at = (date: string, time: string) => new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+07:00`);
  const holiday = (startDate: string, endDate = startDate, title = 'Le'): CalendarBookEvent => ({ type: CalendarEventType.HOLIDAY, title, startDate, endDate });
  const makeup = (date: string): CalendarBookEvent => ({ type: CalendarEventType.MAKEUP_WORKDAY, title: 'Lam bu', startDate: date, endDate: date });
  const attendance = (workDate: string, checkIn: string, checkOut?: string | null) => ({
    userId: USER,
    workDate,
    checkInAt: at(workDate, checkIn),
    checkOutAt: checkOut ? at(workDate, checkOut) : null,
  });
  const leave = (startDate: string, endDate: string, leaveType: LeaveType = LeaveType.ANNUAL) => ({ userId: USER, startDate, endDate, leaveType });
  const overtime = (workDate: string, otStart: string, otEnd: string, estimatedHours = 2) => ({ userId: USER, workDate, otStart, otEnd, estimatedHours });
  const manual = (workDate: string, symbol: TimesheetSymbol, note = 'Sua tay') => ({ userId: USER, workDate, symbol, note });

  function compute(
    options: Partial<Omit<ComputeMonthInput, 'book' | 'now' | 'users'>> & { events?: CalendarBookEvent[]; rules?: Partial<WorkScheduleRules>; now?: Date; joinedAt?: string | null } = {},
  ) {
    const month = options.month ?? MONTH;
    const { start, end } = monthRange(month);
    const result = computeMonth({
      month,
      today: options.today ?? '2026-11-04',
      now: options.now ?? at(options.today ?? '2026-11-04', '10:00'),
      book: buildCalendarBook({ ...schedule, ...options.rules }, options.events ?? [], start, end),
      users: [{ userId: USER, departmentId: 'dept-1', joinedAt: options.joinedAt ?? null }],
      attendances: options.attendances ?? [],
      leaves: options.leaves ?? [],
      overtimes: options.overtimes ?? [],
      entries: options.entries ?? [],
    });
    const user = result.users[0];
    const dayOf = (date: string) => user.days.find((day) => day.date === date)!;
    return { ...result, user, row: user.row, days: user.days, exceptions: user.exceptions, dayOf };
  }
  const typesOn = (exceptions: Array<{ type: TimesheetExceptionType; workDate: string }>, date: string) => exceptions.filter((item) => item.workDate === date).map((item) => item.type);

  describe('kiem tra dau vao', () => {
    it('isValidMonth chi nhan YYYY-MM co that trong khoang hop ly', () => {
      expect(isValidMonth('2026-10')).toBe(true);
      for (const bad of ['2026-13', '2026-00', '2026-1', '26-10', '0001-01', '2026-10-01', '', undefined, null, 202610, ['2026-10']]) {
        expect(isValidMonth(bad)).toBe(false);
      }
    });

    it('isValidDate chi nhan ngay co that', () => {
      expect(isValidDate('2028-02-29')).toBe(true);
      for (const bad of ['2026-02-30', '2026-13-01', '2026-10-1', '01/10/2026', undefined, 20261001]) {
        expect(isValidDate(bad)).toBe(false);
      }
    });

    it('monthRange dung so ngay, ke ca thang 2 nam nhuan', () => {
      expect(monthRange('2026-10')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
      expect(monthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    });
  });

  describe('thang da qua, khong co du lieu', () => {
    it('du moi ngay trong thang; ngay lam viec la V, cuoi tuan symbol null', () => {
      const { days, row, standardDays, dayOf } = compute();
      expect(days).toHaveLength(31);
      expect(days[0].date).toBe('2026-10-01');
      expect(days[30].date).toBe('2026-10-31');
      expect(standardDays).toBe(22);
      expect(dayOf('2026-10-01')).toEqual({
        date: '2026-10-01',
        symbol: TimesheetSymbol.V,
        workValue: 0,
        isWorkingDay: true,
        holidayName: null,
        checkInAt: null,
        checkOutAt: null,
        workedHours: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        otHours: 0,
        isManual: false,
        note: null,
      });
      expect(dayOf('2026-10-03')).toMatchObject({ symbol: null, workValue: 0, isWorkingDay: false });
      expect(row).toMatchObject({ absentDays: 22, paidDays: 0, expectedDays: 22, totalExpectedHours: 176, status: 'insufficient', userId: USER, departmentId: 'dept-1', joinedAt: null, isNewMember: false });
    });

    it('du cong tat ca ngay lam viec -> sufficient', () => {
      const workdays = compute().days.filter((day) => day.isWorkingDay).map((day) => attendance(day.date, '08:30', '17:30'));
      const { row } = compute({ attendances: workdays });
      expect(row).toMatchObject({ actualDays: 22, paidDays: 22, absentDays: 0, totalActualHours: 176, status: 'sufficient' });
    });
  });

  describe('cham cong va so do', () => {
    it('du vao ra -> X, tru gio nghi khi ca tu 5 gio', () => {
      const { dayOf, row } = compute({ attendances: [attendance('2026-10-05', '08:30', '17:30')] });
      expect(dayOf('2026-10-05')).toMatchObject({ symbol: TimesheetSymbol.X, workValue: 1, workedHours: 8, lateMinutes: 0, earlyLeaveMinutes: 0 });
      expect(dayOf('2026-10-05').checkInAt).toBe('2026-10-05T01:30:00.000Z');
      expect(dayOf('2026-10-05').checkOutAt).toBe('2026-10-05T10:30:00.000Z');
      expect(row.actualDays).toBe(1);
    });

    it('gio nghi: duoi 5 gio khong tru, dung 5 gio bat dau tru', () => {
      expect(compute({ attendances: [attendance('2026-10-05', '08:30', '13:29')] }).dayOf('2026-10-05').workedHours).toBe(5);
      expect(compute({ attendances: [attendance('2026-10-05', '08:30', '13:30')] }).dayOf('2026-10-05').workedHours).toBe(4);
    });

    it('tong gio lam tron 1 chu so tu gia tri goc', () => {
      const { row } = compute({ attendances: [attendance('2026-10-05', '08:30', '10:10'), attendance('2026-10-06', '08:30', '10:10')] });
      expect(row.totalActualHours).toBe(3.3);
    });

    it('di muon so o muc phut: het phut 08:30 chua muon, 08:31 muon 1 phut', () => {
      const late = (checkIn: string, rules = {}) => compute({ attendances: [attendance('2026-10-05', checkIn, '17:30')], rules }).dayOf('2026-10-05').lateMinutes;
      expect(late('08:30:59')).toBe(0);
      expect(late('08:31')).toBe(1);
      expect(late('09:00')).toBe(30);
      expect(late('08:35', { lateGraceMinutes: 5 })).toBe(0);
      expect(late('08:36', { lateGraceMinutes: 5 })).toBe(1);
    });

    it('ve som chi tinh khi co gio ra va la X', () => {
      const early = (checkOut: string, rules = {}) => compute({ attendances: [attendance('2026-10-05', '08:30', checkOut)], rules }).dayOf('2026-10-05').earlyLeaveMinutes;
      expect(early('17:30')).toBe(0);
      expect(early('17:29')).toBe(1);
      expect(early('17:20', { earlyLeaveGraceMinutes: 10 })).toBe(0);
      expect(early('17:19', { earlyLeaveGraceMinutes: 10 })).toBe(1);
    });

    it('dem luot muon, som', () => {
      const { row, exceptions } = compute({ attendances: [attendance('2026-10-05', '09:00', '17:00'), attendance('2026-10-06', '08:00', '18:00')] });
      expect(row).toMatchObject({ lateCount: 1, earlyLeaveCount: 1 });
      expect(exceptions.find((item) => item.type === 'LATE')).toMatchObject({ workDate: '2026-10-05', minutes: 30, checkInAt: at('2026-10-05', '09:00').toISOString() });
      expect(exceptions.find((item) => item.type === 'EARLY_LEAVE')).toMatchObject({ workDate: '2026-10-05', minutes: 30 });
    });

    it('lich rieng: gio nghi va gio lam khac doi hoursPerDay va so gio chuan', () => {
      const { row, schedule: view } = compute({ rules: { workStart: '09:00', workEnd: '17:00', breakMinutes: 30 } });
      expect(view).toMatchObject({ workStart: '09:00', hoursPerDay: 7.5 });
      expect(row.totalExpectedHours).toBe(165);
    });
  });

  describe('thieu luot cham', () => {
    const today = '2026-10-14';

    it('hom qua thieu cham ra -> Q; hom nay thieu cham ra -> X dang lam', () => {
      const { dayOf, row, exceptions } = compute({
        today,
        attendances: [attendance('2026-10-13', '08:30'), attendance(today, '08:30')],
      });
      expect(dayOf('2026-10-13')).toMatchObject({ symbol: TimesheetSymbol.Q, workValue: 1, workedHours: 0, earlyLeaveMinutes: 0 });
      expect(dayOf(today)).toMatchObject({ symbol: TimesheetSymbol.X, workValue: 1, workedHours: 0 });
      expect(row).toMatchObject({ missingCheckOutCount: 1, actualDays: 2 });
      expect(typesOn(exceptions, '2026-10-13')).toEqual(['MISSING_CHECKOUT']);
      expect(typesOn(exceptions, today)).toEqual([]);
    });

    it('Q van tinh muon; hom nay di muon cung tinh ngay', () => {
      const { dayOf } = compute({ today, attendances: [attendance('2026-10-13', '09:00'), attendance(today, '08:45')] });
      expect(dayOf('2026-10-13').lateMinutes).toBe(30);
      expect(dayOf(today).lateMinutes).toBe(15);
    });
  });

  describe('le va ngay nghi', () => {
    it('le roi vao ngay lam viec -> L, tinh cong, nam trong cong chuan', () => {
      const { dayOf, row } = compute({ events: [holiday('2026-10-05', '2026-10-05', 'Quoc khanh bu')] });
      expect(dayOf('2026-10-05')).toMatchObject({ symbol: TimesheetSymbol.L, workValue: 1, isWorkingDay: false, holidayName: 'Quoc khanh bu' });
      expect(row).toMatchObject({ paidHolidayDays: 1, paidDays: 1, absentDays: 21, expectedDays: 22 });
    });

    it('le trung cuoi tuan: nhu ngay nghi, khong tinh cong, khong nam trong cong chuan', () => {
      const { dayOf, row, standardDays } = compute({ events: [holiday('2026-10-03', '2026-10-03', 'Le cuoi tuan')] });
      expect(dayOf('2026-10-03')).toMatchObject({ symbol: null, workValue: 0, isWorkingDay: false, holidayName: 'Le cuoi tuan' });
      expect(row).toMatchObject({ paidHolidayDays: 0, expectedDays: 22 });
      expect(standardDays).toBe(22);
    });

    it('le trung cuoi tuan co cham cong -> LN', () => {
      const { dayOf } = compute({ events: [holiday('2026-10-03')], attendances: [attendance('2026-10-03', '08:30', '12:30')] });
      expect(dayOf('2026-10-03')).toMatchObject({ symbol: TimesheetSymbol.LN, workedHours: 4 });
    });

    it('le roi vao ngay lam co cham cong: van L, giu so do gio, khong tinh muon', () => {
      const { dayOf, row } = compute({ events: [holiday('2026-10-05')], attendances: [attendance('2026-10-05', '10:00', '12:00')] });
      expect(dayOf('2026-10-05')).toMatchObject({ symbol: TimesheetSymbol.L, workValue: 1, workedHours: 2, lateMinutes: 0, earlyLeaveMinutes: 0 });
      expect(row.actualDays).toBe(0);
      expect(row.totalActualHours).toBe(2);
    });

    it('le thang don nghi: khong ton phep trong ngay le', () => {
      const { dayOf } = compute({ events: [holiday('2026-10-06')], leaves: [leave('2026-10-05', '2026-10-07')] });
      expect(dayOf('2026-10-05').symbol).toBe(TimesheetSymbol.P);
      expect(dayOf('2026-10-06').symbol).toBe(TimesheetSymbol.L);
      expect(dayOf('2026-10-07').symbol).toBe(TimesheetSymbol.P);
    });

    it('di lam ngay nghi tuan -> LN: khong tinh cong, gio van cong, khong muon, khong vang', () => {
      const { dayOf, row, exceptions } = compute({ attendances: [attendance('2026-10-03', '12:00', '17:00')] });
      expect(dayOf('2026-10-03')).toMatchObject({ symbol: TimesheetSymbol.LN, workValue: 0, lateMinutes: 0, earlyLeaveMinutes: 0, workedHours: 4 });
      expect(row).toMatchObject({ offDayWorkDays: 1, totalActualHours: 4, paidDays: 0, lateCount: 0 });
      expect(typesOn(exceptions, '2026-10-03')).toEqual([]);
    });

    it('thieu cham ra ngay nghi van la LN, khong phai Q', () => {
      const { dayOf, row } = compute({ attendances: [attendance('2026-10-03', '08:30')] });
      expect(dayOf('2026-10-03').symbol).toBe(TimesheetSymbol.LN);
      expect(row.missingCheckOutCount).toBe(0);
    });
  });

  describe('lam bu', () => {
    it('lam bu cuoi tuan: la ngay lam viec, nam trong cong chuan, khong den thi vang', () => {
      const { dayOf, row, standardDays } = compute({ events: [makeup('2026-10-03')] });
      expect(dayOf('2026-10-03')).toMatchObject({ symbol: TimesheetSymbol.V, isWorkingDay: true });
      expect(row).toMatchObject({ expectedDays: 23, absentDays: 23 });
      expect(standardDays).toBe(23);
    });

    it('lam bu co cham cong -> X, tinh muon nhu ngay thuong', () => {
      const { dayOf } = compute({ events: [makeup('2026-10-03')], attendances: [attendance('2026-10-03', '09:00', '17:30')] });
      expect(dayOf('2026-10-03')).toMatchObject({ symbol: TimesheetSymbol.X, workValue: 1, lateMinutes: 30 });
    });

    it('don nghi phu ngay lam bu -> tinh theo loai nghi', () => {
      const { dayOf } = compute({ events: [makeup('2026-10-03')], leaves: [leave('2026-10-02', '2026-10-05', LeaveType.SICK)] });
      expect(dayOf('2026-10-03').symbol).toBe(TimesheetSymbol.OM);
      expect(dayOf('2026-10-04').symbol).toBeNull();
    });

    it('le trung lam bu cuoi tuan -> L, nam trong cong chuan', () => {
      const { dayOf, row } = compute({ events: [makeup('2026-10-03'), holiday('2026-10-03')] });
      expect(dayOf('2026-10-03')).toMatchObject({ symbol: TimesheetSymbol.L, workValue: 1, isWorkingDay: false });
      expect(row).toMatchObject({ expectedDays: 23, paidHolidayDays: 1 });
    });
  });

  describe('don nghi', () => {
    it('anh xa dung ky hieu va so cong theo loai', () => {
      const { dayOf, row } = compute({
        leaves: [leave('2026-10-05', '2026-10-05', LeaveType.ANNUAL), leave('2026-10-06', '2026-10-06', LeaveType.SICK), leave('2026-10-07', '2026-10-07', LeaveType.UNPAID)],
      });
      expect(dayOf('2026-10-05')).toMatchObject({ symbol: TimesheetSymbol.P, workValue: 1 });
      expect(dayOf('2026-10-06')).toMatchObject({ symbol: TimesheetSymbol.OM, workValue: 1 });
      expect(dayOf('2026-10-07')).toMatchObject({ symbol: TimesheetSymbol.KL, workValue: 0 });
      expect(row).toMatchObject({ paidLeaveDays: 2, unpaidLeaveDays: 1, paidDays: 2, absentDays: 19 });
    });

    it('don vat qua 2 thang chi lay phan trong thang, cuoi tuan trong don khong co ky hieu', () => {
      const { dayOf, row } = compute({ leaves: [leave('2026-09-28', '2026-10-02'), leave('2026-10-30', '2026-11-03')] });
      expect(dayOf('2026-10-01').symbol).toBe(TimesheetSymbol.P);
      expect(dayOf('2026-10-02').symbol).toBe(TimesheetSymbol.P);
      expect(dayOf('2026-10-05').symbol).toBe(TimesheetSymbol.V);
      expect(dayOf('2026-10-30').symbol).toBe(TimesheetSymbol.P);
      expect(dayOf('2026-10-31').symbol).toBeNull();
      expect(row.paidLeaveDays).toBe(3);
    });

    it('cham cong thang don nghi', () => {
      const { dayOf, row } = compute({ leaves: [leave('2026-10-05', '2026-10-06')], attendances: [attendance('2026-10-05', '08:30', '17:30'), attendance('2026-10-06', '08:30')] });
      expect(dayOf('2026-10-05').symbol).toBe(TimesheetSymbol.X);
      expect(dayOf('2026-10-06').symbol).toBe(TimesheetSymbol.Q);
      expect(row.paidLeaveDays).toBe(0);
    });
  });

  describe('ngay vao lam', () => {
    it('vao giua thang: truoc ngay vao lam khong co ky hieu, bo qua moi du lieu con sot', () => {
      const { dayOf, row, exceptions } = compute({
        joinedAt: '2026-10-15',
        attendances: [attendance('2026-10-14', '09:00', '17:30'), attendance('2026-10-15', '08:30', '17:30')],
        leaves: [leave('2026-10-12', '2026-10-13')],
        entries: [manual('2026-10-09', TimesheetSymbol.X)],
        overtimes: [overtime('2026-10-14', '18:00', '20:00')],
      });
      expect(dayOf('2026-10-14')).toMatchObject({ symbol: null, workValue: 0, isWorkingDay: true, checkInAt: null, lateMinutes: 0, otHours: 0, isManual: false });
      expect(dayOf('2026-10-13').symbol).toBeNull();
      expect(dayOf('2026-10-09').symbol).toBeNull();
      expect(dayOf('2026-10-15').symbol).toBe(TimesheetSymbol.X);
      // 15, 16, 19-23, 26-30 = 12 ngay.
      expect(row).toMatchObject({ expectedDays: 12, isNewMember: true, hasManual: false, approvedOtHours: 0, actualDays: 1, absentDays: 11, status: 'insufficient', joinedAt: '2026-10-15' });
      expect(exceptions.filter((item) => item.workDate < '2026-10-15')).toEqual([]);
    });

    it('vao ngay dau thang khong phai nguoi moi; vao thang truoc cung vay', () => {
      expect(compute({ joinedAt: '2026-10-01' }).row).toMatchObject({ isNewMember: false, expectedDays: 22 });
      expect(compute({ joinedAt: '2026-05-20' }).row).toMatchObject({ isNewMember: false, expectedDays: 22 });
    });

    it('vao sau cuoi thang -> notJoined, khong co gi', () => {
      const { row, days, exceptions } = compute({ joinedAt: '2026-11-01' });
      expect(row).toMatchObject({ status: 'notJoined', expectedDays: 0, paidDays: 0, totalExpectedHours: 0, isNewMember: false });
      expect(days.every((day) => day.symbol === null)).toBe(true);
      expect(days).toHaveLength(31);
      expect(exceptions).toEqual([]);
    });

    it('nguoi moi du cong tu ngay vao -> sufficient', () => {
      const workdays = compute({ joinedAt: '2026-10-26' }).days.filter((day) => day.date >= '2026-10-26' && day.isWorkingDay);
      const { row } = compute({ joinedAt: '2026-10-26', attendances: workdays.map((day) => attendance(day.date, '08:30', '17:30')) });
      expect(row).toMatchObject({ expectedDays: 5, paidDays: 5, status: 'sufficient' });
    });
  });

  describe('dong sua tay', () => {
    it('thay ky hieu va so cong, gan isManual va ghi chu', () => {
      const { dayOf, row, exceptions } = compute({ entries: [manual('2026-10-05', TimesheetSymbol.P, 'Don giay')] });
      expect(dayOf('2026-10-05')).toMatchObject({ symbol: TimesheetSymbol.P, workValue: 1, isManual: true, note: 'Don giay' });
      expect(row).toMatchObject({ hasManual: true, paidLeaveDays: 1, absentDays: 21 });
      expect(typesOn(exceptions, '2026-10-05')).toEqual([]);
    });

    it('so do cham cong van giu; ky hieu thuoc X, Q, LN van giu muon, som', () => {
      const attendances = [attendance('2026-10-05', '09:00', '17:00')];
      for (const symbol of [TimesheetSymbol.X, TimesheetSymbol.Q, TimesheetSymbol.LN]) {
        const { dayOf } = compute({ attendances, entries: [manual('2026-10-05', symbol)] });
        expect(dayOf('2026-10-05')).toMatchObject({ symbol, lateMinutes: 30, earlyLeaveMinutes: 30, workedHours: 7 });
      }
    });

    it('ky hieu khong phai di lam: muon, som bang 0 nhung gio vao ra van giu', () => {
      for (const symbol of [TimesheetSymbol.P, TimesheetSymbol.OM, TimesheetSymbol.KL, TimesheetSymbol.L, TimesheetSymbol.V]) {
        const { dayOf, row } = compute({ attendances: [attendance('2026-10-05', '09:00', '17:00')], entries: [manual('2026-10-05', symbol)] });
        expect(dayOf('2026-10-05')).toMatchObject({ symbol, lateMinutes: 0, earlyLeaveMinutes: 0, workedHours: 7 });
        expect(dayOf('2026-10-05').checkInAt).not.toBeNull();
        expect(row.lateCount).toBe(0);
      }
    });

    it('thang ca le va ngay nghi; ngoai le theo ky hieu sau khi sua', () => {
      const { dayOf, exceptions, row } = compute({
        events: [holiday('2026-10-05')],
        entries: [manual('2026-10-05', TimesheetSymbol.X), manual('2026-10-03', TimesheetSymbol.V)],
      });
      expect(dayOf('2026-10-05')).toMatchObject({ symbol: TimesheetSymbol.X, workValue: 1 });
      expect(dayOf('2026-10-03')).toMatchObject({ symbol: TimesheetSymbol.V, workValue: 0 });
      expect(typesOn(exceptions, '2026-10-03')).toEqual(['ABSENT']);
      expect(row.paidHolidayDays).toBe(0);
    });

    it('sua Q thanh X thi het thieu luot', () => {
      const { row, exceptions } = compute({ attendances: [attendance('2026-10-05', '08:30')], entries: [manual('2026-10-05', TimesheetSymbol.X)] });
      expect(row.missingCheckOutCount).toBe(0);
      expect(typesOn(exceptions, '2026-10-05')).toEqual([]);
    });
  });

  describe('lam them', () => {
    const ot = [overtime('2026-10-05', '18:00', '20:00')];

    it('tinh phan giao giua khung da duyet va khoang vao-ra', () => {
      const hours = (checkOut: string, checkIn = '08:30') => compute({ attendances: [attendance('2026-10-05', checkIn, checkOut)], overtimes: ot }).dayOf('2026-10-05').otHours;
      expect(hours('20:00')).toBe(2);
      expect(hours('21:00')).toBe(2);
      expect(hours('19:00')).toBe(1);
      expect(hours('17:30')).toBe(0);
      expect(hours('20:00', '19:30')).toBe(0.5);
    });

    it('tach gio thuc te voi gio da duyet', () => {
      const { row } = compute({ attendances: [attendance('2026-10-05', '08:30', '19:00')], overtimes: ot });
      expect(row).toMatchObject({ otHours: 1, approvedOtHours: 2 });
    });

    it('2 khung chong nhau khong tinh 2 lan', () => {
      const { dayOf, row } = compute({
        attendances: [attendance('2026-10-05', '08:30', '21:00')],
        overtimes: [overtime('2026-10-05', '18:00', '20:00'), overtime('2026-10-05', '19:00', '21:00')],
      });
      expect(dayOf('2026-10-05').otHours).toBe(3);
      expect(row.approvedOtHours).toBe(4);
    });

    it('lam them ngay nghi va ngay le van tinh', () => {
      const { dayOf } = compute({ attendances: [attendance('2026-10-03', '08:00', '12:00')], overtimes: [overtime('2026-10-03', '08:00', '11:00', 3)] });
      expect(dayOf('2026-10-03')).toMatchObject({ symbol: TimesheetSymbol.LN, otHours: 3 });
    });

    it('khong co cham cong -> 0 gio va sinh OT_NO_ATTENDANCE', () => {
      const { dayOf, exceptions } = compute({ overtimes: ot });
      expect(dayOf('2026-10-05').otHours).toBe(0);
      expect(exceptions.find((item) => item.type === 'OT_NO_ATTENDANCE')).toEqual({
        type: 'OT_NO_ATTENDANCE',
        userId: USER,
        workDate: '2026-10-05',
        otHours: 2,
        checkInAt: null,
        checkOutAt: null,
      });
    });

    it('thieu cham ra -> 0 gio va sinh OT_NO_ATTENDANCE kem gio vao', () => {
      const { dayOf, exceptions } = compute({ attendances: [attendance('2026-10-05', '08:30')], overtimes: ot });
      expect(dayOf('2026-10-05').otHours).toBe(0);
      expect(typesOn(exceptions, '2026-10-05')).toEqual(['MISSING_CHECKOUT', 'OT_NO_ATTENDANCE']);
      expect(exceptions.find((item) => item.type === 'OT_NO_ATTENDANCE')?.checkInAt).toBe(at('2026-10-05', '08:30').toISOString());
    });

    it('nhieu don cung ngay chi sinh 1 ngoai le, cong gio', () => {
      const { exceptions } = compute({ overtimes: [overtime('2026-10-05', '18:00', '19:00', 1), overtime('2026-10-05', '19:00', '21:00', 2)] });
      const items = exceptions.filter((item) => item.type === 'OT_NO_ATTENDANCE');
      expect(items).toHaveLength(1);
      expect(items[0].otHours).toBe(3);
    });

    it('khung chua ket thuc hoac ngay tuong lai thi chua la ngoai le', () => {
      const today = '2026-10-14';
      const todayOt = [overtime(today, '18:00', '20:00'), overtime('2026-10-20', '18:00', '20:00')];
      const before = compute({ today, now: at(today, '19:59'), attendances: [attendance(today, '08:30')], overtimes: todayOt });
      expect(before.exceptions.filter((item) => item.type === 'OT_NO_ATTENDANCE')).toEqual([]);
      const after = compute({ today, now: at(today, '20:00'), attendances: [attendance(today, '08:30')], overtimes: todayOt });
      expect(after.exceptions.filter((item) => item.type === 'OT_NO_ATTENDANCE').map((item) => item.workDate)).toEqual([today]);
    });
  });

  describe('thang hien tai', () => {
    const today = '2026-10-14';

    it('ngay chua toi khong tinh vang, hom nay chua cham khong tinh vang', () => {
      const { dayOf, row } = compute({ today });
      expect(dayOf('2026-10-13').symbol).toBe(TimesheetSymbol.V);
      expect(dayOf(today).symbol).toBeNull();
      expect(dayOf('2026-10-15').symbol).toBeNull();
      // 01, 02, 05-09, 12, 13 = 9 ngay vang; cong chuan van tinh tron thang.
      expect(row).toMatchObject({ absentDays: 9, expectedDays: 22, status: 'insufficient' });
    });

    it('le va don nghi da duyet o tuong lai van co ky hieu', () => {
      const { dayOf, row } = compute({ today, events: [holiday('2026-10-20')], leaves: [leave('2026-10-21', '2026-10-21')] });
      expect(dayOf('2026-10-20').symbol).toBe(TimesheetSymbol.L);
      expect(dayOf('2026-10-21').symbol).toBe(TimesheetSymbol.P);
      expect(row).toMatchObject({ paidHolidayDays: 1, paidLeaveDays: 1 });
    });

    it('thang tuong lai khong co vang', () => {
      expect(compute({ month: '2026-12', today }).row.absentDays).toBe(0);
    });

    describe('NOT_CHECKED_IN', () => {
      const notCheckedIn = (options: Parameters<typeof compute>[0]) => typesOn(compute({ today, ...options }).exceptions, today).includes('NOT_CHECKED_IN');

      it('chi sau workStart + gia han', () => {
        expect(notCheckedIn({ now: at(today, '08:30') })).toBe(false);
        expect(notCheckedIn({ now: at(today, '08:31') })).toBe(true);
        expect(notCheckedIn({ now: at(today, '08:40'), rules: { lateGraceMinutes: 10 } })).toBe(false);
        expect(notCheckedIn({ now: at(today, '08:41'), rules: { lateGraceMinutes: 10 } })).toBe(true);
      });

      it('khong sinh khi da cham, dang nghi, ngay le, ngay nghi tuan, co sua tay, chua vao lam', () => {
        const now = at(today, '10:00');
        expect(notCheckedIn({ now, attendances: [attendance(today, '08:30')] })).toBe(false);
        expect(notCheckedIn({ now, leaves: [leave(today, today)] })).toBe(false);
        expect(notCheckedIn({ now, events: [holiday(today)] })).toBe(false);
        expect(notCheckedIn({ now, rules: { workingWeekdays: [1] } })).toBe(false);
        expect(notCheckedIn({ now, entries: [manual(today, TimesheetSymbol.P)] })).toBe(false);
        expect(notCheckedIn({ now, joinedAt: '2026-10-15' })).toBe(false);
      });

      it('chi cho hom nay, khong cho ngay khac', () => {
        const { exceptions } = compute({ today, now: at(today, '10:00') });
        expect(exceptions.filter((item) => item.type === 'NOT_CHECKED_IN').map((item) => item.workDate)).toEqual([today]);
      });
    });
  });

  describe('gio GMT+7 quanh nua dem UTC', () => {
    const date = '2026-10-15';

    it('cham 00:10 GMT+7 (17:10 UTC ngay truoc) thuoc dung ngay, khong tinh muon', () => {
      const { dayOf } = compute({
        attendances: [{ userId: USER, workDate: date, checkInAt: new Date('2026-10-14T17:10:00.000Z'), checkOutAt: new Date('2026-10-15T10:30:00.000Z') }],
      });
      expect(dayOf(date)).toMatchObject({ symbol: TimesheetSymbol.X, lateMinutes: 0, earlyLeaveMinutes: 0 });
    });

    it('08:31 GMT+7 la 01:31 UTC: muon 1 phut theo gio Viet Nam', () => {
      const { dayOf } = compute({
        attendances: [{ userId: USER, workDate: date, checkInAt: new Date('2026-10-15T01:31:00.000Z'), checkOutAt: new Date('2026-10-15T10:30:00.000Z') }],
      });
      expect(dayOf(date).lateMinutes).toBe(1);
    });

    it('ra sau nua dem GMT+7 (sang hom sau): khong ve som, gio lam va OT tinh qua nua dem', () => {
      const { dayOf } = compute({
        attendances: [{ userId: USER, workDate: date, checkInAt: new Date('2026-10-15T01:30:00.000Z'), checkOutAt: new Date('2026-10-15T17:30:00.000Z') }],
        overtimes: [overtime(date, '22:00', '23:59', 2)],
      });
      expect(dayOf(date)).toMatchObject({ earlyLeaveMinutes: 0, workedHours: 15, otHours: 2 });
    });

    it('nhan ca chuoi ISO nhu du lieu doc tu snapshot', () => {
      const { dayOf } = compute({ attendances: [{ userId: USER, workDate: date, checkInAt: '2026-10-15T01:31:00.000Z', checkOutAt: '2026-10-15T10:30:00.000Z' }] });
      expect(dayOf(date).lateMinutes).toBe(1);
      expect(dayOf(date).checkInAt).toBe('2026-10-15T01:31:00.000Z');
    });

    it('NOT_CHECKED_IN tinh theo gio GMT+7 ngay ca khi `now` con o ngay truoc theo UTC', () => {
      const today = '2026-10-15';
      const { exceptions } = compute({ today, now: new Date('2026-10-15T01:31:00.000Z') });
      expect(typesOn(exceptions, today)).toEqual(['NOT_CHECKED_IN']);
      const early = compute({ today, now: new Date('2026-10-14T18:00:00.000Z') });
      expect(typesOn(early.exceptions, today)).toEqual([]);
    });
  });

  describe('ket qua dung lam snapshot', () => {
    it('JSON thuan: luu va doc lai khong mat gi', () => {
      const result = computeMonth({
        month: MONTH,
        today: '2026-11-04',
        now: at('2026-11-04', '10:00'),
        book: buildCalendarBook(schedule, [holiday('2026-10-05')], '2026-10-01', '2026-10-31'),
        users: [{ userId: USER, departmentId: null, joinedAt: '2026-10-02' }],
        attendances: [attendance('2026-10-06', '09:00', '17:00')],
        leaves: [leave('2026-10-07', '2026-10-07')],
        overtimes: [overtime('2026-10-08', '18:00', '20:00')],
        entries: [manual('2026-10-09', TimesheetSymbol.X)],
      });
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    });

    it('moi nguoi tinh rieng, khong lan du lieu', () => {
      const result = computeMonth({
        month: MONTH,
        today: '2026-11-04',
        now: at('2026-11-04', '10:00'),
        book: buildCalendarBook(schedule, [], '2026-10-01', '2026-10-31'),
        users: [
          { userId: 'a', departmentId: null, joinedAt: null },
          { userId: 'b', departmentId: null, joinedAt: null },
        ],
        attendances: [{ userId: 'a', workDate: '2026-10-05', checkInAt: at('2026-10-05', '08:30'), checkOutAt: at('2026-10-05', '17:30') }],
        leaves: [{ userId: 'b', startDate: '2026-10-05', endDate: '2026-10-05', leaveType: LeaveType.UNPAID }],
        overtimes: [],
        entries: [],
      });
      expect(result.users[0].days[4].symbol).toBe(TimesheetSymbol.X);
      expect(result.users[1].days[4].symbol).toBe(TimesheetSymbol.KL);
    });
  });

  describe('collectExceptions', () => {
    const month = () =>
      compute({
        attendances: [attendance('2026-10-05', '09:00', '17:00'), attendance('2026-10-06', '08:30')],
        overtimes: [overtime('2026-10-07', '18:00', '20:00')],
      }).user;

    it('dem du moi loai, ke ca loai bang 0, khong phu thuoc bo loc', () => {
      const { counts } = collectExceptions([month()], 'LATE');
      expect(counts).toEqual({ LATE: 1, EARLY_LEAVE: 1, ABSENT: 20, MISSING_CHECKOUT: 1, NOT_CHECKED_IN: 0, OT_NO_ATTENDANCE: 1 });
    });

    it('loc theo loai', () => {
      const { rows } = collectExceptions([month()], 'MISSING_CHECKOUT');
      expect(rows.map((row) => row.workDate)).toEqual(['2026-10-06']);
    });

    it('sap ngay giam dan, on dinh theo nguoi roi loai', () => {
      const first = month();
      const second = { ...first, exceptions: first.exceptions.map((item) => ({ ...item, userId: 'user-0' })) };
      const { rows } = collectExceptions([first, second]);
      const dates = rows.map((row) => row.workDate);
      expect(dates).toEqual([...dates].sort().reverse());
      const sameDay = rows.filter((row) => row.workDate === '2026-10-05');
      expect(sameDay.map((row) => `${row.userId}:${row.type}`)).toEqual(['user-0:EARLY_LEAVE', 'user-0:LATE', 'user-1:EARLY_LEAVE', 'user-1:LATE']);
    });

    it('khong co nguoi nao -> rong, counts van du khoa', () => {
      expect(collectExceptions([])).toEqual({ rows: [], counts: { LATE: 0, EARLY_LEAVE: 0, ABSENT: 0, MISSING_CHECKOUT: 0, NOT_CHECKED_IN: 0, OT_NO_ATTENDANCE: 0 } });
    });
  });
});
