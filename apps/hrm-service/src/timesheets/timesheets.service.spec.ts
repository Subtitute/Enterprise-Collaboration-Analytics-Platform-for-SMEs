import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, LeaveRequestStatus, LeaveType, PERMISSIONS, TimesheetSymbol } from '@app/common-dto';
import { toGmt7DateString } from '../attendance/attendance-date.util';
import { AttendanceAdjustment } from '../entities/attendance-adjustment.entity';
import { Attendance } from '../entities/attendance.entity';
import { DimUser } from '../entities/dim-user.entity';
import { LeaveRequest } from '../entities/leave-request.entity';
import { OvertimeRequest } from '../entities/overtime-request.entity';
import { TimesheetEntry } from '../entities/timesheet-entry.entity';
import { TimesheetPeriod } from '../entities/timesheet-period.entity';
import { periodLockKey } from '../work-calendar/period-lock.service';
import { WorkScheduleRules, addDays, buildCalendarBook } from '../work-calendar/work-calendar.util';
import { TimesheetMonthResult, computeMonth } from './timesheet-calculator';
import { TimesheetsService } from './timesheets.service';

/** 04/11/2026: mock thu cong DataSource/EntityManager; phep tinh chi tiet nam o timesheet-calculator.spec.ts. */
describe('TimesheetsService', () => {
  const org = 'org-1';
  const ADMIN = '11111111-1111-4111-8111-111111111111';
  const MANAGER = '22222222-2222-4222-8222-222222222222';
  const MEMBER = '33333333-3333-4333-8333-333333333333';
  const OUTSIDER = '44444444-4444-4444-8444-444444444444';
  const DEPT = 'dept-1';
  const PAST_MONTH = '2026-01';

  const admin = { userId: ADMIN, permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.ATTENDANCE_VIEW], departmentId: null };
  const manager = { userId: MANAGER, permissions: [PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_ADJUSTMENT_APPROVE], departmentId: DEPT };

  const schedule: WorkScheduleRules = { workingWeekdays: [1, 2, 3, 4, 5], workStart: '08:30', workEnd: '17:30', lateGraceMinutes: 0, earlyLeaveGraceMinutes: 0, breakMinutes: 60 };
  const dimUsers = () => [
    { userId: ADMIN, organizationId: org, departmentId: null, joinedAt: null },
    { userId: MANAGER, organizationId: org, departmentId: DEPT, joinedAt: '2020-01-01' },
    { userId: MEMBER, organizationId: org, departmentId: DEPT, joinedAt: '2020-01-01' },
    { userId: OUTSIDER, organizationId: org, departmentId: 'dept-2', joinedAt: '2020-01-01' },
  ];

  /** Du lieu thang gia lap, loc dung theo dieu kien `where` ma service gui xuong. */
  function setup(data: { period?: unknown; attendances?: unknown[]; leaves?: unknown[]; overtimes?: unknown[]; entries?: unknown[]; pending?: { leave?: number; overtime?: number; adjustment?: number }; users?: any[] } = {}) {
    const users = data.users ?? dimUsers();
    const inScope = (rows: any[], where: any) => (where?.userId?.value ? rows.filter((row) => where.userId.value.includes(row.userId)) : rows);
    const tx = {
      query: jest.fn().mockResolvedValue([]),
      find: jest.fn(async (entity: unknown, options: any) => {
        if (entity === DimUser) return inScope(users, options.where);
        if (entity === Attendance) return inScope(data.attendances ?? [], options.where);
        if (entity === LeaveRequest) return inScope(data.leaves ?? [], options.where);
        if (entity === OvertimeRequest) return inScope(data.overtimes ?? [], options.where);
        if (entity === TimesheetEntry) return inScope(data.entries ?? [], options.where);
        return [];
      }),
      findOne: jest.fn(async (entity: unknown, options: any) => {
        if (entity === TimesheetPeriod) return data.period ?? null;
        if (entity === DimUser) return users.find((user) => user.userId === options.where.userId) ?? null;
        return null;
      }),
      count: jest.fn(async (entity: unknown, _options?: any) => {
        if (entity === LeaveRequest) return data.pending?.leave ?? 0;
        if (entity === OvertimeRequest) return data.pending?.overtime ?? 0;
        if (entity === AttendanceAdjustment) return data.pending?.adjustment ?? 0;
        return 0;
      }),
      create: jest.fn((_entity: unknown, value: object) => ({ ...value })),
      save: jest.fn(async (entity: unknown) => entity),
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const dimRepo = { find: jest.fn(async (options: any) => users.filter((user) => user.departmentId === options.where.departmentId)) };
    const dataSource = { manager: tx, transaction: jest.fn((work: any) => work(tx)), getRepository: jest.fn().mockReturnValue(dimRepo) };
    const workCalendarService = { loadBook: jest.fn(async (_org: string, from: string, to: string) => buildCalendarBook(schedule, [], from, to)) };
    const periodLockService = { assertOpen: jest.fn().mockResolvedValue(undefined) };
    const service = new TimesheetsService(dataSource as any, workCalendarService as any, periodLockService as any);
    return { service, tx, dataSource, workCalendarService, periodLockService };
  }

  function snapshotOf(month: string): TimesheetMonthResult {
    const { start, end } = { start: `${month}-01`, end: `${month}-31` };
    return computeMonth({
      month,
      today: '2026-11-04',
      now: new Date('2026-11-04T03:00:00Z'),
      book: buildCalendarBook(schedule, [], start, end),
      users: dimUsers().map(({ userId, departmentId, joinedAt }) => ({ userId, departmentId, joinedAt })),
      attendances: [],
      leaves: [],
      overtimes: [],
      entries: [],
    });
  }

  const lockedPeriod = (month = PAST_MONTH) => ({
    id: 'p-1',
    organizationId: org,
    year: Number(month.slice(0, 4)),
    month: Number(month.slice(5, 7)),
    status: 'LOCKED',
    lockedAt: new Date('2026-02-01T00:00:00Z'),
    lockedByUserId: ADMIN,
    unlockedAt: null,
    unlockReason: null,
    snapshot: JSON.parse(JSON.stringify(snapshotOf(month))),
  });

  describe('getMonth', () => {
    it.each(['2026-13', 'abc', undefined, ''])('thang sai "%s" -> TIMESHEET_MONTH_INVALID', async (month) => {
      const { service } = setup();
      await expect(service.getMonth(org, month as string, admin)).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_MONTH_INVALID }) });
    });

    it('thang mo: tinh truc tiep, tra dung hop dong, period mac dinh OPEN', async () => {
      const { service, workCalendarService } = setup({
        attendances: [{ userId: MEMBER, workDate: '2026-01-05', checkInAt: new Date('2026-01-05T01:30:00Z'), checkOutAt: new Date('2026-01-05T10:30:00Z') }],
        leaves: [{ userId: MEMBER, startDate: '2026-01-06', endDate: '2026-01-06', leaveType: LeaveType.SICK }],
      });

      const result = await service.getMonth(org, PAST_MONTH, admin);

      expect(Object.keys(result).sort()).toEqual(['month', 'period', 'rows', 'schedule', 'standardDays']);
      expect(result.period).toEqual({ status: 'OPEN', lockedAt: null, lockedByUserId: null, unlockedAt: null, unlockReason: null });
      expect(result.standardDays).toBe(22);
      expect(result.schedule).toMatchObject({ workStart: '08:30', hoursPerDay: 8 });
      expect(result.schedule).not.toHaveProperty('organizationId');
      expect(result.rows).toHaveLength(4);
      const row = result.rows.find((item) => item.userId === MEMBER)!;
      expect(Object.keys(row).sort()).toEqual(
        [
          'userId',
          'departmentId',
          'joinedAt',
          'actualDays',
          'offDayWorkDays',
          'paidLeaveDays',
          'unpaidLeaveDays',
          'paidHolidayDays',
          'absentDays',
          'paidDays',
          'expectedDays',
          'totalActualHours',
          'totalExpectedHours',
          'lateCount',
          'earlyLeaveCount',
          'missingCheckOutCount',
          'otHours',
          'approvedOtHours',
          'hasManual',
          'isNewMember',
          'status',
        ].sort(),
      );
      expect(row).toMatchObject({ actualDays: 1, paidLeaveDays: 1, paidDays: 2, departmentId: DEPT, joinedAt: '2020-01-01' });
      expect(workCalendarService.loadBook).toHaveBeenCalledWith(org, '2026-01-01', '2026-01-31');
    });

    it('chi nap don DA DUYET va du lieu trong thang', async () => {
      const { service, tx } = setup();
      await service.getMonth(org, PAST_MONTH, admin);
      const leaveCall = tx.find.mock.calls.find(([entity]) => entity === LeaveRequest)!;
      expect(leaveCall[1].where.status).toBe(LeaveRequestStatus.APPROVED);
      expect(leaveCall[1].where.startDate.value).toBe('2026-01-31');
      expect(leaveCall[1].where.endDate.value).toBe('2026-01-01');
      const otCall = tx.find.mock.calls.find(([entity]) => entity === OvertimeRequest)!;
      expect(otCall[1].where.status).toBe('APPROVED');
    });

    it('Manager chi thay chinh minh + phong ban; Employee chi thay minh', async () => {
      const asManager = await setup().service.getMonth(org, PAST_MONTH, manager);
      expect(asManager.rows.map((row) => row.userId).sort()).toEqual([MANAGER, MEMBER].sort());

      const employee = { userId: MEMBER, permissions: [PERMISSIONS.ATTENDANCE_CHECKIN], departmentId: DEPT };
      const asEmployee = await setup().service.getMonth(org, PAST_MONTH, employee);
      expect(asEmployee.rows.map((row) => row.userId)).toEqual([MEMBER]);
    });

    it('thang khoa: doc snapshot, khong tinh lai, loc theo pham vi', async () => {
      const { service, tx, workCalendarService } = setup({ period: lockedPeriod() });

      const asManager = await service.getMonth(org, PAST_MONTH, manager);

      expect(asManager.period).toMatchObject({ status: 'LOCKED', lockedByUserId: ADMIN });
      expect(asManager.rows.map((row) => row.userId).sort()).toEqual([MANAGER, MEMBER].sort());
      expect(asManager.standardDays).toBe(snapshotOf(PAST_MONTH).standardDays);
      expect(workCalendarService.loadBook).not.toHaveBeenCalled();
      expect(tx.find.mock.calls.filter(([entity]) => entity === Attendance)).toEqual([]);

      const asAdmin = await service.getMonth(org, PAST_MONTH, admin);
      expect(asAdmin.rows).toHaveLength(4);
    });

    // 04/11/2026: nhan vien da vo hieu hoa khong con bi tinh vang ca thang.
    describe('nguoi da vo hieu hoa', () => {
      const withInactive = () => dimUsers().map((user) => (user.userId === OUTSIDER ? { ...user, isActive: false } : { ...user, isActive: true }));
      const attendance = { userId: OUTSIDER, workDate: '2026-01-05', checkInAt: new Date('2026-01-05T01:30:00Z'), checkOutAt: new Date('2026-01-05T10:30:00Z') };

      it('thang mo: khong cham cong trong thang -> khong co dong, ca ngoai le lan chi tiet', async () => {
        const { service } = setup({ users: withInactive() });

        const { rows } = await service.getMonth(org, PAST_MONTH, admin);
        expect(rows.map((row) => row.userId)).not.toContain(OUTSIDER);
        expect(rows).toHaveLength(3);

        const exceptions = await service.getExceptions(org, { month: PAST_MONTH, page: 1, limit: 500 } as any, admin);
        expect(exceptions.data.map((row) => row.userId)).not.toContain(OUTSIDER);
        await expect(service.getUserMonth(org, OUTSIDER, PAST_MONTH, admin)).rejects.toBeInstanceOf(NotFoundException);
      });

      it('thang mo: co cham cong trong thang -> van duoc tinh cong', async () => {
        const { service } = setup({ users: withInactive(), attendances: [attendance] });

        const { rows } = await service.getMonth(org, PAST_MONTH, admin);
        expect(rows.find((row) => row.userId === OUTSIDER)?.actualDays).toBe(1);
      });

      it('khoa ky: snapshot chi gom nguoi duoc tinh cong', async () => {
        const { service, tx } = setup({ users: withInactive() });

        await service.lock(org, PAST_MONTH, ADMIN, {});

        const saved = tx.save.mock.calls[0][0] as { snapshot: TimesheetMonthResult };
        expect(saved.snapshot.users.map((user) => user.row.userId).sort()).toEqual([ADMIN, MANAGER, MEMBER].sort());
      });

      it('thang da khoa: snapshot giu nguyen du nguoi do da bi vo hieu hoa sau khi khoa', async () => {
        const { service } = setup({ users: withInactive(), period: lockedPeriod() });

        const { rows } = await service.getMonth(org, PAST_MONTH, admin);
        expect(rows.map((row) => row.userId)).toContain(OUTSIDER);
      });
    });
  });

  describe('getUserMonth', () => {
    it('tra summary cung dang dong va du moi ngay trong thang', async () => {
      const { service } = setup();
      const result = await service.getUserMonth(org, MEMBER, PAST_MONTH, manager);
      expect(Object.keys(result).sort()).toEqual(['days', 'month', 'period', 'summary']);
      expect(result.summary.userId).toBe(MEMBER);
      expect(result.days).toHaveLength(31);
      expect(result.days.find((day) => day.date === '2026-01-03')?.symbol).toBeNull();
    });

    it('ngoai pham vi, khong ton tai, id hong -> 404', async () => {
      const { service } = setup();
      await expect(service.getUserMonth(org, OUTSIDER, PAST_MONTH, manager)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getUserMonth(org, '55555555-5555-4555-8555-555555555555', PAST_MONTH, admin)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getUserMonth(org, 'khong-phai-uuid', PAST_MONTH, admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('thang khoa: doc tu snapshot; ngoai pham vi van 404', async () => {
      const { service, workCalendarService } = setup({ period: lockedPeriod() });
      const result = await service.getUserMonth(org, MEMBER, PAST_MONTH, manager);
      expect(result.days).toHaveLength(31);
      expect(result.period.status).toBe('LOCKED');
      expect(workCalendarService.loadBook).not.toHaveBeenCalled();
      await expect(service.getUserMonth(org, OUTSIDER, PAST_MONTH, manager)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('nguoi khong co trong snapshot (tao sau khi khoa) -> 404', async () => {
      const period = lockedPeriod();
      period.snapshot.users = period.snapshot.users.filter((user: any) => user.row.userId !== MEMBER);
      const { service } = setup({ period });
      await expect(service.getUserMonth(org, MEMBER, PAST_MONTH, admin)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getExceptions', () => {
    const query = (extra = {}) => ({ month: PAST_MONTH, page: 1, limit: 20, ...extra });

    it('dung dang paginate(), kem counts va pending', async () => {
      const { service } = setup({ pending: { leave: 1, overtime: 2, adjustment: 3 }, users: [dimUsers()[2]] });
      const result = await service.getExceptions(org, query(), admin);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 22 });
      expect(result.data).toHaveLength(20);
      expect(result.counts).toEqual({ LATE: 0, EARLY_LEAVE: 0, ABSENT: 22, MISSING_CHECKOUT: 0, NOT_CHECKED_IN: 0, OT_NO_ATTENDANCE: 0 });
      expect(result.pending).toEqual({ leave: 1, overtime: 2, adjustment: 3 });
      expect(result.data[0]).toEqual({ type: 'ABSENT', userId: MEMBER, workDate: '2026-01-30' });
    });

    it('phan trang va loc theo loai; counts khong doi theo bo loc', async () => {
      const { service } = setup({ users: [dimUsers()[2]] });
      const page2 = await service.getExceptions(org, query({ page: 2 }), admin);
      expect(page2.data).toHaveLength(2);
      expect(page2.meta.page).toBe(2);

      const filtered = await service.getExceptions(org, query({ type: 'LATE' }), admin);
      expect(filtered.data).toEqual([]);
      expect(filtered.meta.total).toBe(0);
      expect(filtered.counts.ABSENT).toBe(22);
    });

    it('thang sai -> TIMESHEET_MONTH_INVALID', async () => {
      const { service } = setup();
      await expect(service.getExceptions(org, query({ month: 'x' }), admin)).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_MONTH_INVALID }) });
    });

    it('Manager: chi ngoai le va don cho trong pham vi', async () => {
      const { service, tx } = setup();
      const result = await service.getExceptions(org, query({ limit: 500 }), manager);
      expect(new Set(result.data.map((row) => row.userId))).toEqual(new Set([MANAGER, MEMBER]));
      const where = tx.count.mock.calls[0][1].where;
      expect(where.userId.value.sort()).toEqual([MANAGER, MEMBER].sort());
    });

    it('Org Admin: don cho khong gioi han nguoi; thang khoa doc ngoai le tu snapshot', async () => {
      const { service, tx, workCalendarService } = setup({ period: lockedPeriod() });
      const result = await service.getExceptions(org, query(), admin);
      expect(tx.count.mock.calls[0][1].where).not.toHaveProperty('userId');
      expect(result.counts.ABSENT).toBeGreaterThan(0);
      expect(workCalendarService.loadBook).not.toHaveBeenCalled();
    });
  });

  describe('upsertEntry', () => {
    const today = toGmt7DateString(new Date());
    const dto = (extra = {}) => ({ userId: MEMBER, workDate: '2026-01-05', symbol: TimesheetSymbol.P, note: 'Don giay', ...extra });

    it('luu 1 dong theo nguoi + ngay trong giao dich sau assertOpen, tra dung 1 phan tu days', async () => {
      const entries = [{ userId: MEMBER, workDate: '2026-01-05', symbol: TimesheetSymbol.P, note: 'Don giay' }];
      const { service, tx, periodLockService } = setup({ entries });

      const day = await service.upsertEntry(org, MANAGER, dto({ note: '  Don giay  ' }), manager);

      expect(periodLockService.assertOpen).toHaveBeenCalledWith(org, ['2026-01-05'], tx);
      expect(periodLockService.assertOpen.mock.invocationCallOrder[0]).toBeLessThan(tx.upsert.mock.invocationCallOrder[0]);
      expect(tx.upsert).toHaveBeenCalledWith(
        TimesheetEntry,
        { organizationId: org, userId: MEMBER, workDate: '2026-01-05', symbol: TimesheetSymbol.P, note: 'Don giay', updatedByUserId: MANAGER },
        ['organizationId', 'userId', 'workDate'],
      );
      expect(day).toMatchObject({ date: '2026-01-05', symbol: TimesheetSymbol.P, isManual: true, note: 'Don giay', workValue: 1 });
    });

    it.each([
      ['thieu ghi chu', { note: undefined }],
      ['ghi chu toan khoang trang', { note: '   ' }],
      ['ky hieu sai', { symbol: 'ABC' }],
      ['ngay sai', { workDate: '2026-02-30' }],
      ['ngay khong dung dinh dang', { workDate: '05/01/2026' }],
      ['userId khong phai uuid', { userId: 'abc' }],
    ])('%s -> TIMESHEET_ENTRY_INVALID, khong luu', async (_name, patch) => {
      const { service, tx } = setup();
      await expect(service.upsertEntry(org, ADMIN, dto(patch) as any, admin)).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_ENTRY_INVALID }) });
      expect(tx.upsert).not.toHaveBeenCalled();
    });

    it('ngay tuong lai, truoc ngay vao lam, nguoi ngoai to chuc -> TIMESHEET_ENTRY_INVALID', async () => {
      const { service, tx } = setup();
      const invalid = { response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_ENTRY_INVALID }) };
      await expect(service.upsertEntry(org, ADMIN, dto({ workDate: addDays(today, 1) }), admin)).rejects.toMatchObject(invalid);
      await expect(service.upsertEntry(org, ADMIN, dto({ workDate: '2019-12-31' }), admin)).rejects.toMatchObject(invalid);
      await expect(service.upsertEntry(org, ADMIN, dto({ userId: '55555555-5555-4555-8555-555555555555' }), admin)).rejects.toMatchObject(invalid);
      expect(tx.upsert).not.toHaveBeenCalled();
    });

    it('sua dung hom nay va dung ngay vao lam van duoc', async () => {
      const { service } = setup();
      await expect(service.upsertEntry(org, ADMIN, dto({ workDate: today }), admin)).resolves.toMatchObject({ date: today });
      await expect(service.upsertEntry(org, ADMIN, dto({ workDate: '2020-01-01' }), admin)).resolves.toMatchObject({ date: '2020-01-01' });
    });

    it('assertCanDecide: Manager khong tu sua minh, khong sua ngoai phong ban', async () => {
      const { service, tx } = setup();
      await expect(service.upsertEntry(org, MANAGER, dto({ userId: MANAGER }), manager)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.upsertEntry(org, MANAGER, dto({ userId: OUTSIDER }), manager)).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.upsert).not.toHaveBeenCalled();
    });

    it('ky da khoa -> loi assertOpen, khong luu', async () => {
      const { service, tx, periodLockService } = setup();
      periodLockService.assertOpen.mockRejectedValue(new ConflictException({ errorCode: ERROR_CODES.TIMESHEET_PERIOD_LOCKED }));
      await expect(service.upsertEntry(org, MANAGER, dto(), manager)).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_PERIOD_LOCKED }) });
      expect(tx.upsert).not.toHaveBeenCalled();
    });
  });

  describe('deleteEntry', () => {
    it('xoa dung dong sau assertOpen, khong tra body', async () => {
      const { service, tx, periodLockService } = setup();
      await expect(service.deleteEntry(org, MEMBER, '2026-01-05', manager)).resolves.toBeUndefined();
      expect(periodLockService.assertOpen).toHaveBeenCalledWith(org, ['2026-01-05'], tx);
      expect(tx.delete).toHaveBeenCalledWith(TimesheetEntry, { organizationId: org, userId: MEMBER, workDate: '2026-01-05' });
    });

    it('ky khoa, ngoai pham vi, tham so hong -> khong xoa', async () => {
      const locked = setup();
      locked.periodLockService.assertOpen.mockRejectedValue(new ConflictException({ errorCode: ERROR_CODES.TIMESHEET_PERIOD_LOCKED }));
      await expect(locked.service.deleteEntry(org, MEMBER, '2026-01-05', manager)).rejects.toBeInstanceOf(ConflictException);
      expect(locked.tx.delete).not.toHaveBeenCalled();

      const { service, tx } = setup();
      await expect(service.deleteEntry(org, OUTSIDER, '2026-01-05', manager)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.deleteEntry(org, 'abc', '2026-01-05', admin)).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_ENTRY_INVALID }) });
      await expect(service.deleteEntry(org, MEMBER, 'abc', admin)).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_ENTRY_INVALID }) });
      expect(tx.delete).not.toHaveBeenCalled();
    });
  });

  describe('lock', () => {
    const currentMonth = () => toGmt7DateString(new Date()).slice(0, 7);

    it('thang chua ket thuc -> TIMESHEET_PERIOD_NOT_ENDED, khong mo giao dich', async () => {
      const { service, dataSource } = setup();
      await expect(service.lock(org, currentMonth(), ADMIN, {})).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_PERIOD_NOT_ENDED }) });
      await expect(service.lock(org, '2100-01', ADMIN, {})).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_PERIOD_NOT_ENDED }) });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('thang sai -> TIMESHEET_MONTH_INVALID', async () => {
      const { service } = setup();
      await expect(service.lock(org, 'abc', ADMIN, {})).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_MONTH_INVALID }) });
    });

    it('da khoa -> 409 TIMESHEET_PERIOD_ALREADY_LOCKED', async () => {
      const { service, tx } = setup({ period: lockedPeriod() });
      await expect(service.lock(org, PAST_MONTH, ADMIN, { force: true })).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_PERIOD_ALREADY_LOCKED }) });
      expect(tx.save).not.toHaveBeenCalled();
    });

    it('con don cho, khong force -> 409 kem so don trong errorParams, khong luu', async () => {
      const { service, tx } = setup({ pending: { leave: 2, overtime: 1, adjustment: 3 } });
      await expect(service.lock(org, PAST_MONTH, ADMIN, {})).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_PERIOD_HAS_PENDING, errorParams: { leave: 2, overtime: 1, adjustment: 3 } }),
      });
      expect(tx.save).not.toHaveBeenCalled();
    });

    it('dem don cho dung thang: don nghi giao thang, 2 loai kia theo workDate, toan to chuc', async () => {
      const { service, tx } = setup();
      await service.lock(org, PAST_MONTH, ADMIN, {});
      const [leave, overtime, adjustment] = tx.count.mock.calls;
      expect(leave[1].where.status).toBe(LeaveRequestStatus.PENDING);
      expect(leave[1].where.startDate.value).toBe('2026-01-31');
      expect(leave[1].where.endDate.value).toBe('2026-01-01');
      expect(overtime[1].where.workDate.value).toEqual(['2026-01-01', '2026-01-31']);
      expect(adjustment[1].where.workDate.value).toEqual(['2026-01-01', '2026-01-31']);
      for (const call of [leave, overtime, adjustment]) expect(call[1].where).not.toHaveProperty('userId');
    });

    it('con don cho, force -> van khoa', async () => {
      const { service, tx } = setup({ pending: { leave: 2 } });
      await expect(service.lock(org, PAST_MONTH, ADMIN, { force: true })).resolves.toMatchObject({ period: { status: 'LOCKED' } });
      expect(tx.save).toHaveBeenCalledTimes(1);
    });

    it('giu khoa tu van doc quyen truoc moi lan doc; tinh toan to chuc, luu snapshot du rows va days', async () => {
      const { service, tx } = setup({
        attendances: [{ userId: OUTSIDER, workDate: '2026-01-05', checkInAt: new Date('2026-01-05T01:30:00Z'), checkOutAt: new Date('2026-01-05T10:30:00Z') }],
      });

      const result = await service.lock(org, PAST_MONTH, ADMIN, {});

      expect(tx.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [periodLockKey(org, PAST_MONTH)]);
      expect(tx.query.mock.invocationCallOrder[0]).toBeLessThan(tx.findOne.mock.invocationCallOrder[0]);
      const saved = tx.save.mock.calls[0][0] as { status: string; lockedByUserId: string; lockedAt: Date; year: number; month: number; snapshot: TimesheetMonthResult };
      expect(saved).toMatchObject({ organizationId: org, year: 2026, month: 1, status: 'LOCKED', lockedByUserId: ADMIN });
      expect(saved.lockedAt).toBeInstanceOf(Date);
      expect(saved.snapshot.users.map((user) => user.row.userId).sort()).toEqual([ADMIN, MANAGER, MEMBER, OUTSIDER].sort());
      expect(saved.snapshot.users.every((user) => user.days.length === 31)).toBe(true);
      expect(saved.snapshot.users.find((user) => user.row.userId === OUTSIDER)?.row.actualDays).toBe(1);
      expect(saved.snapshot).toMatchObject({ month: PAST_MONTH, standardDays: 22 });
      expect(JSON.parse(JSON.stringify(saved.snapshot))).toEqual(saved.snapshot);
      expect(result).toMatchObject({ month: PAST_MONTH, period: { status: 'LOCKED', lockedByUserId: ADMIN } });
      expect(result.period).not.toHaveProperty('snapshot');
    });

    it('khoa lai sau khi da mo: dung lai dong cu', async () => {
      const period = { id: 'p-1', organizationId: org, year: 2026, month: 1, status: 'OPEN', snapshot: null, unlockReason: 'Sua so lieu' };
      const { service, tx } = setup({ period });
      await service.lock(org, PAST_MONTH, ADMIN, {});
      expect(tx.create).not.toHaveBeenCalled();
      expect(tx.save.mock.calls[0][0]).toMatchObject({ id: 'p-1', status: 'LOCKED' });
    });

    it('khoa xong doc lai dung nhu luc tinh, khong phu thuoc nguoi xem', async () => {
      const first = setup();
      await first.service.lock(org, PAST_MONTH, ADMIN, {});
      const saved = JSON.parse(JSON.stringify(first.tx.save.mock.calls[0][0]));
      const live = await first.service.getMonth(org, PAST_MONTH, manager);

      const { service } = setup({ period: saved });
      const fromSnapshot = await service.getMonth(org, PAST_MONTH, manager);
      expect(fromSnapshot.rows).toEqual(live.rows);
    });
  });

  describe('unlock', () => {
    it('xoa snapshot, ghi nguoi va ly do, khong dung toi dong sua tay', async () => {
      const { service, tx } = setup({ period: lockedPeriod() });

      const result = await service.unlock(org, PAST_MONTH, ADMIN, { reason: '  Sua so lieu  ' });

      expect(tx.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [periodLockKey(org, PAST_MONTH)]);
      const saved = tx.save.mock.calls[0][0] as Record<string, unknown>;
      expect(saved).toMatchObject({ status: 'OPEN', snapshot: null, unlockedByUserId: ADMIN, unlockReason: 'Sua so lieu' });
      expect(saved.unlockedAt).toBeInstanceOf(Date);
      expect(tx.delete).not.toHaveBeenCalled();
      expect(result.period).toMatchObject({ status: 'OPEN', unlockReason: 'Sua so lieu' });
    });

    it('chua khoa hoac chua co dong -> 409 TIMESHEET_PERIOD_NOT_LOCKED', async () => {
      const notLocked = { status: 409, response: expect.objectContaining({ errorCode: ERROR_CODES.TIMESHEET_PERIOD_NOT_LOCKED }) };
      await expect(setup().service.unlock(org, PAST_MONTH, ADMIN, { reason: 'x' })).rejects.toMatchObject(notLocked);
      await expect(setup({ period: { status: 'OPEN' } }).service.unlock(org, PAST_MONTH, ADMIN, { reason: 'x' })).rejects.toMatchObject(notLocked);
    });

    it('sau khi mo khoa: tinh lai truc tiep, dong sua tay van co hieu luc', async () => {
      const entries = [{ userId: MEMBER, workDate: '2026-01-05', symbol: TimesheetSymbol.P, note: 'Giu lai' }];
      const { service } = setup({ period: { id: 'p-1', status: 'OPEN', snapshot: null, unlockReason: 'x', unlockedAt: new Date() }, entries });
      const detail = await service.getUserMonth(org, MEMBER, PAST_MONTH, admin);
      expect(detail.period).toMatchObject({ status: 'OPEN', unlockReason: 'x' });
      expect(detail.days.find((day) => day.date === '2026-01-05')).toMatchObject({ symbol: TimesheetSymbol.P, isManual: true });
    });
  });
});
