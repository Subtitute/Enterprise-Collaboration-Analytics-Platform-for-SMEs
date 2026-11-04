import { CalendarEventType } from '@app/common-dto';
import {
  WorkScheduleRules,
  addDays,
  buildCalendarBook,
  computeHoursPerDay,
  countWorkingDays,
  countWorkingDaysInYear,
  daysInclusive,
  findWorkScheduleError,
  listHolidays,
  monthProbes,
  weekdayOf,
  yearsInRange,
} from './work-calendar.util';

/** 04/11/2026: xem work-calendar.util.ts. */
describe('work-calendar.util', () => {
  const schedule: WorkScheduleRules = {
    workingWeekdays: [1, 2, 3, 4, 5],
    workStart: '08:30',
    workEnd: '17:30',
    lateGraceMinutes: 0,
    earlyLeaveGraceMinutes: 0,
    breakMinutes: 60,
  };
  const FROM = '2025-01-01';
  const TO = '2026-12-31';
  const holiday = (startDate: string, endDate = startDate, title = 'Le') => ({ type: CalendarEventType.HOLIDAY, title, startDate, endDate });
  const makeup = (startDate: string, endDate = startDate) => ({ type: CalendarEventType.MAKEUP_WORKDAY, title: 'Lam bu', startDate, endDate });

  describe('phep tinh ngay', () => {
    it('addDays qua cuoi thang, cuoi nam, nam nhuan', () => {
      expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
      expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('weekdayOf khop lich that (0 = Chu nhat)', () => {
      expect(weekdayOf('2025-06-02')).toBe(1); // Thu Hai
      expect(weekdayOf('2025-06-01')).toBe(0); // Chu Nhat
      expect(weekdayOf('2025-05-31')).toBe(6); // Thu Bay
    });

    it('daysInclusive tinh ca 2 dau mut', () => {
      expect(daysInclusive('2026-11-04', '2026-11-04')).toBe(1);
      expect(daysInclusive('2028-01-01', '2028-12-31')).toBe(366);
    });

    it('yearsInRange tra ve moi nam khoang ngay cham toi', () => {
      expect(yearsInRange('2026-03-01', '2026-03-02')).toEqual([2026]);
      expect(yearsInRange('2026-12-30', '2027-01-02')).toEqual([2026, 2027]);
    });

    it('monthProbes co dung 1 ngay cho moi thang, khong sot thang giua', () => {
      expect(monthProbes('2026-01-15', '2026-01-20')).toEqual(['2026-01-15']);
      expect(monthProbes('2026-01-30', '2026-03-02')).toEqual(['2026-01-30', '2026-02-01', '2026-03-01']);
      expect(monthProbes('2026-12-30', '2027-01-01')).toEqual(['2026-12-30', '2027-01-01']);
    });
  });

  // Chuyen tu spec cua countWorkingDaysInclusive cu: Thu 2 - Thu 6 la lich mac dinh.
  describe('countWorkingDays - lich mac dinh, khong co le', () => {
    const book = buildCalendarBook(schedule, [], FROM, TO);

    it('dem dung 5 ngay cho 1 tuan tron', () => {
      expect(countWorkingDays(book, '2025-06-02', '2025-06-06')).toBe(5);
    });

    it('loai tru Thu 7/Chu Nhat', () => {
      expect(countWorkingDays(book, '2025-05-30', '2025-06-08')).toBe(6);
    });

    it('tra ve 0 khi ca khoang roi vao cuoi tuan', () => {
      expect(countWorkingDays(book, '2025-05-31', '2025-06-01')).toBe(0);
    });

    it('start = end la ngay lam viec -> 1; start sau end -> 0', () => {
      expect(countWorkingDays(book, '2025-06-02', '2025-06-02')).toBe(1);
      expect(countWorkingDays(book, '2025-06-06', '2025-06-02')).toBe(0);
    });
  });

  describe('buildCalendarBook - thu tu uu tien', () => {
    it('le nam trong khoang nghi khong tinh la ngay lam viec', () => {
      const book = buildCalendarBook(schedule, [holiday('2025-06-04', '2025-06-04', 'Le A')], FROM, TO);
      expect(book.isWorkingDay('2025-06-04')).toBe(false);
      expect(book.holidayOf('2025-06-04')).toEqual({ date: '2025-06-04', title: 'Le A' });
      expect(countWorkingDays(book, '2025-06-02', '2025-06-06')).toBe(4);
    });

    it('lam bu bien cuoi tuan thanh ngay lam viec', () => {
      const book = buildCalendarBook(schedule, [makeup('2025-05-31')], FROM, TO);
      expect(book.isWorkingDay('2025-05-31')).toBe(true);
      expect(book.isMakeup('2025-05-31')).toBe(true);
      expect(countWorkingDays(book, '2025-05-31', '2025-06-01')).toBe(1);
    });

    it('le trung lam bu: le thang nhung van giu dau vet lam bu cho bang cong', () => {
      const book = buildCalendarBook(schedule, [makeup('2025-05-31'), holiday('2025-05-31')], FROM, TO);
      expect(book.isWorkingDay('2025-05-31')).toBe(false);
      expect(book.isMakeup('2025-05-31')).toBe(true);
      expect(book.isScheduledWorkday('2025-05-31')).toBe(true);
    });

    it('isScheduledWorkday phan biet le roi vao ngay lam voi le roi vao ngay nghi tuan', () => {
      const book = buildCalendarBook(schedule, [holiday('2025-06-04'), holiday('2025-06-07')], FROM, TO);
      expect(book.isScheduledWorkday('2025-06-04')).toBe(true);
      expect(book.isScheduledWorkday('2025-06-07')).toBe(false);
    });

    it('lam bu vao ngay da la ngay lam viec khong dem 2 lan', () => {
      const book = buildCalendarBook(schedule, [makeup('2025-06-02')], FROM, TO);
      expect(countWorkingDays(book, '2025-06-02', '2025-06-02')).toBe(1);
    });

    it('lich rieng cua to chuc: lam ca Thu 7, nghi Thu 2', () => {
      const book = buildCalendarBook({ ...schedule, workingWeekdays: [2, 3, 4, 5, 6] }, [], FROM, TO);
      expect(book.isWorkingDay('2025-06-02')).toBe(false);
      expect(book.isWorkingDay('2025-06-07')).toBe(true);
    });

    it('EVENT thuong khong anh huong lich', () => {
      const book = buildCalendarBook(schedule, [{ type: CalendarEventType.EVENT, title: 'Hop', startDate: '2025-06-02', endDate: '2025-06-08' }], FROM, TO);
      expect(book.isWorkingDay('2025-06-02')).toBe(true);
      expect(book.isWorkingDay('2025-06-07')).toBe(false);
      expect(book.holidayOf('2025-06-02')).toBeNull();
    });

    it('le nhieu ngay duoc cat theo khoang da nap, 2 le trung ngay lay le dau tien', () => {
      const book = buildCalendarBook(schedule, [holiday('2025-01-28', '2025-02-03', 'Tet'), holiday('2025-02-01', '2025-02-01', 'Khac')], '2025-02-01', '2025-02-02');
      expect(listHolidays(book, '2025-02-01', '2025-02-02')).toEqual([
        { date: '2025-02-01', title: 'Tet' },
        { date: '2025-02-02', title: 'Tet' },
      ]);
    });
  });

  it('countWorkingDaysInYear chi dem phan nam trong nam dang xet', () => {
    const book = buildCalendarBook(schedule, [], FROM, TO);
    // 30/12/2025 (T3) -> 02/01/2026 (T6): 2 ngay moi nam.
    expect(countWorkingDaysInYear(book, '2025-12-30', '2026-01-02', 2025)).toBe(2);
    expect(countWorkingDaysInYear(book, '2025-12-30', '2026-01-02', 2026)).toBe(2);
    expect(countWorkingDaysInYear(book, '2025-12-30', '2026-01-02', 2024)).toBe(0);
  });

  describe('findWorkScheduleError', () => {
    it('lich mac dinh hop le, hoursPerDay = 8', () => {
      expect(findWorkScheduleError(schedule)).toBeNull();
      expect(computeHoursPerDay(schedule)).toBe(8);
    });

    it.each([
      ['weekday rong', { workingWeekdays: [] }],
      ['weekday trung', { workingWeekdays: [1, 1] }],
      ['weekday ngoai 0-6', { workingWeekdays: [7] }],
      ['weekday le', { workingWeekdays: [1.5] }],
      ['weekday khong phai mang', { workingWeekdays: 'x' }],
      ['gio sai dinh dang', { workStart: '8:30' }],
      ['gio vuot 23:59', { workEnd: '24:00' }],
      ['gio khong phai chuoi', { workStart: 830 }],
      ['workEnd bang workStart', { workStart: '08:30', workEnd: '08:30' }],
      ['workEnd truoc workStart', { workStart: '17:30', workEnd: '08:30' }],
      ['so phut am', { lateGraceMinutes: -1 }],
      ['so phut qua 240', { earlyLeaveGraceMinutes: 241 }],
      ['so phut le', { breakMinutes: 1.5 }],
      ['so phut null', { breakMinutes: null }],
      ['gio nghi bang ca lam', { workStart: '08:00', workEnd: '10:00', breakMinutes: 120 }],
    ])('%s -> loi', (_name, patch) => {
      expect(findWorkScheduleError({ ...schedule, ...(patch as object) } as WorkScheduleRules)).toEqual(expect.any(String));
    });

    it('chap nhan dung bien: 0 va 240 phut, Chu nhat', () => {
      expect(findWorkScheduleError({ ...schedule, workingWeekdays: [0], lateGraceMinutes: 240, breakMinutes: 0 })).toBeNull();
    });
  });
});
