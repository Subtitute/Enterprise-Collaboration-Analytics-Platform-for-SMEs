import { CalendarEventType, LeaveRequestStatus, LeaveType } from '@app/common-dto';
import { buildCalendarBook } from '../work-calendar/work-calendar.util';
import { BalanceRequest, computeSeniorityBonusDays, computeYearBalance } from './leave-balance.util';

/** 04/11/2026: xem leave-balance.util.ts. */
describe('leave-balance.util', () => {
  describe('computeSeniorityBonusDays', () => {
    const TODAY = '2026-11-04';

    it('khong co joinedAt hoac chu ky khong hop le -> 0', () => {
      expect(computeSeniorityBonusDays(null, 2026, TODAY, 5)).toBe(0);
      expect(computeSeniorityBonusDays(undefined, 2026, TODAY, 5)).toBe(0);
      expect(computeSeniorityBonusDays('2010-01-01', 2026, TODAY, 0)).toBe(0);
    });

    it('chi tinh nam lam TRON: thieu 1 ngay chua du 5 nam', () => {
      expect(computeSeniorityBonusDays('2021-11-04', 2026, TODAY, 5)).toBe(1);
      expect(computeSeniorityBonusDays('2021-11-05', 2026, TODAY, 5)).toBe(0);
    });

    it('floor theo chu ky: 11 nam / 5 = 2 ngay', () => {
      expect(computeSeniorityBonusDays('2015-01-01', 2026, TODAY, 5)).toBe(2);
    });

    it('vao lam sau moc xet (tuong lai) khong ra so am', () => {
      expect(computeSeniorityBonusDays('2030-01-01', 2026, TODAY, 5)).toBe(0);
    });

    it('nam sau tinh toi 01/01 cua nam do, nam truoc tinh toi 31/12 cua nam do', () => {
      expect(computeSeniorityBonusDays('2022-01-01', 2027, '2026-12-30', 5)).toBe(1);
      expect(computeSeniorityBonusDays('2022-06-01', 2027, '2026-12-30', 5)).toBe(0);
      expect(computeSeniorityBonusDays('2020-12-31', 2025, TODAY, 5)).toBe(1);
      expect(computeSeniorityBonusDays('2021-01-01', 2025, TODAY, 5)).toBe(0);
    });

    it('vao lam 29/02: den 28/02 nam thuong chua tron nam, 01/03 moi tron', () => {
      expect(computeSeniorityBonusDays('2024-02-29', 2025, '2025-02-28', 1)).toBe(0);
      expect(computeSeniorityBonusDays('2024-02-29', 2025, '2025-03-01', 1)).toBe(1);
    });
  });

  describe('computeYearBalance', () => {
    const schedule = { workingWeekdays: [1, 2, 3, 4, 5], workStart: '08:30', workEnd: '17:30', lateGraceMinutes: 0, earlyLeaveGraceMinutes: 0, breakMinutes: 60 };
    const book = buildCalendarBook(schedule, [], '2025-01-01', '2026-12-31');
    const policy = { baseDaysPerYear: 12, seniorityYearsPerBonusDay: 5 };
    // 02/06/2025 (T2) -> 06/06/2025 (T6): 5 ngay lam viec.
    const week = (overrides: Partial<BalanceRequest> = {}): BalanceRequest => ({
      startDate: '2025-06-02',
      endDate: '2025-06-06',
      status: LeaveRequestStatus.APPROVED,
      leaveType: LeaveType.ANNUAL,
      ...overrides,
    });
    const compute = (requests: BalanceRequest[], extra: Record<string, unknown> = {}) =>
      computeYearBalance({ year: 2025, today: '2025-07-01', policy, adjustmentDays: 0, requests, book, ...extra });

    it('khong co don, khong co joinedAt: thuc huong = co ban', () => {
      expect(compute([])).toEqual({ year: 2025, usedDays: 0, pendingDays: 0, adjustmentDays: 0, seniorityBonusDays: 0, entitledDays: 12, remainingDays: 12 });
    });

    it('thuc huong = co ban + tham nien + dieu chinh; con lai tru ca da duyet lan dang cho', () => {
      const balance = compute([week(), week({ startDate: '2025-07-07', endDate: '2025-07-08', status: LeaveRequestStatus.PENDING })], {
        joinedAt: '2015-01-01',
        adjustmentDays: 3,
      });
      expect(balance).toEqual({ year: 2025, usedDays: 5, pendingDays: 2, adjustmentDays: 3, seniorityBonusDays: 2, entitledDays: 17, remainingDays: 10 });
    });

    it('dieu chinh am lam giam thuc huong, con lai co the am', () => {
      expect(compute([week()], { adjustmentDays: -10 })).toMatchObject({ entitledDays: 2, remainingDays: -3 });
    });

    it('nghi om va nghi khong luong khong tru so du', () => {
      const balance = compute([
        week({ leaveType: LeaveType.SICK }),
        week({ leaveType: LeaveType.UNPAID, status: LeaveRequestStatus.PENDING }),
      ]);
      expect(balance).toMatchObject({ usedDays: 0, pendingDays: 0, remainingDays: 12 });
    });

    it('don REJECTED (ke ca da huy) khong tinh', () => {
      expect(compute([week({ status: LeaveRequestStatus.REJECTED })])).toMatchObject({ usedDays: 0, pendingDays: 0 });
    });

    it('don dang xet khong bi tinh vao dang cho - tranh dem 2 lan khi duyet', () => {
      const balance = compute([week({ id: 'a', status: LeaveRequestStatus.PENDING }), week({ id: 'b', startDate: '2025-07-07', endDate: '2025-07-07', status: LeaveRequestStatus.PENDING })], {
        excludeRequestId: 'a',
      });
      expect(balance.pendingDays).toBe(1);
    });

    it('don vat qua giao thua chi tru phan thuoc nam dang xet', () => {
      const crossYear = week({ startDate: '2025-12-30', endDate: '2026-01-02' });
      expect(compute([crossYear]).usedDays).toBe(2);
      expect(compute([crossYear], { year: 2026 }).usedDays).toBe(2);
    });

    it('le nam trong don khong tru phep', () => {
      const withHoliday = buildCalendarBook(schedule, [{ type: CalendarEventType.HOLIDAY, title: 'Le', startDate: '2025-06-04', endDate: '2025-06-04' }], '2025-01-01', '2025-12-31');
      expect(compute([week()], { book: withHoliday }).usedDays).toBe(4);
    });
  });
});
