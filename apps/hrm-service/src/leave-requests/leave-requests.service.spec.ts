import { CalendarEventType, ERROR_CODES, EVENT_TYPES, LeaveRequestStatus, LeaveType } from '@app/common-dto';
import { toGmt7DateString } from '../attendance/attendance-date.util';
import { DimUser } from '../entities/dim-user.entity';
import { LeaveBalanceAdjustment } from '../entities/leave-balance-adjustment.entity';
import { LeaveRequest } from '../entities/leave-request.entity';
import { CalendarBookEvent, WorkScheduleRules, addDays, buildCalendarBook, monthProbes, weekdayOf } from '../work-calendar/work-calendar.util';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto';

/**
 * Unit test cho LeaveRequestsService - tap trung vao decide() (approve/reject), logic chua duoc
 * test o muc service (audit phat hien thieu). decide() dung pattern khoa pessimistic_write +
 * re-check BEN TRONG transaction de tranh race condition khi 2 Manager cung duyet/tu choi 1 yeu
 * cau nghi phep dong thoi - mirror ProjectsService.complete()/archive() va
 * TasksService.updateStatus() (apps/project-task-service), xem test cung pattern tai
 * apps/project-task-service/src/tasks/tasks.service.spec.ts ("updateStatus - fix race condition
 * keo-tha dong thoi").
 *
 * Mock thu cong DataSource/Repository/OutboxService, khong boot NestJS module hay DB that.
 */
describe('LeaveRequestsService', () => {
  const organizationId = 'org-1';
  const userId = 'user-1';
  const leaveRequestId = 'lr-1';
  const approverId = 'approver-1';

  // 15/09/2026: tinh ngay TUONG DOI voi "hom nay" thay vi hardcode 1 chuoi ngay co dinh - test cu
  // dung '2026-09-01' hardcode se tu dong tro thanh "qua khu" va bat dau FAIL sau ngay do (dung
  // hop kinh dien: da xay ra ngay khi them validation moi cho loi nay - '2026-09-01' luc viet test
  // ban dau la tuong lai, nhung nay da la qua khu thuc su theo dong ho he thong). Dung +N ngay ke
  // tu hom nay de test luon dung bat ke chay vao thoi diem nao.
  //
  // 24/10/2026 (fix loi thuc te phat hien khi chay gate): ban truoc dung `d.toISOString()` (UTC)
  // de tinh "hom nay", trong khi logic chan ngay qua khu cua service so sanh voi
  // `toGmt7DateString()` (GMT+7) - 2 ham nay LECH NHAU dung 1 ngay trong khung gio 00:00-07:00
  // GMT+7, khien futureDateStr(0) tra ve ngay "hom qua" theo GMT+7 va test tu fail ngay trong
  // khung gio do (mirror dung lop loi da sua o calendar-events.service.spec.ts cung ngay). Sua
  // bang cach dung lai CHINH toGmt7DateString() thay vi tu tinh rieng mot lan nua.
  function futureDateStr(daysFromNow: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return toGmt7DateString(d);
  }

  function pendingRequest(overrides: Record<string, unknown> = {}) {
    return {
      id: leaveRequestId,
      organizationId,
      userId,
      status: LeaveRequestStatus.PENDING,
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      reason: 'Nghi kham benh',
      leaveType: LeaveType.ANNUAL,
      approverId: null,
      decisionNote: null,
      decidedAt: null,
      ...overrides,
    };
  }

  // 04/11/2026: mac dinh moi ngay deu la ngay lam viec de test khong phu thuoc hom nay la thu may; test nao
  // xet lich thi truyen schedule/events rieng (dung lich that, khong mock isWorkingDay).
  const ALL_DAYS: WorkScheduleRules = {
    workingWeekdays: [0, 1, 2, 3, 4, 5, 6],
    workStart: '08:30',
    workEnd: '17:30',
    lateGraceMinutes: 0,
    earlyLeaveGraceMinutes: 0,
    breakMinutes: 60,
  };

  function createService(opts: {
    leaveRequestRepoMock?: { findOne: jest.Mock; findAndCount?: jest.Mock };
    managerMock?: { findOne?: jest.Mock; find?: jest.Mock; create?: jest.Mock; save: jest.Mock };
    leavePolicyServiceMock?: { getOrCreate: jest.Mock };
    schedule?: WorkScheduleRules;
    events?: CalendarBookEvent[];
    assertOpen?: jest.Mock;
    dimUserFindOne?: jest.Mock;
  } = {}) {
    const managerMock = {
      query: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entityClass: unknown, data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      ...opts.managerMock,
    };
    const dimUserRepoMock = { findOne: opts.dimUserFindOne ?? jest.fn().mockResolvedValue({ userId: 'member' }) };
    const dataSourceMock = {
      transaction: jest.fn((cb: any) => cb(managerMock)),
      manager: managerMock,
      getRepository: jest.fn().mockReturnValue(dimUserRepoMock),
    };
    const leaveRequestRepoMock = opts.leaveRequestRepoMock ?? { findOne: jest.fn() };
    const adjustmentRepoMock = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([]),
    };
    const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };
    // 22/09/2026: so du phep (getMyBalance()) - mac dinh mock chinh sach 12 ngay/nam, +1 ngay/5 nam.
    const leavePolicyServiceMock =
      opts.leavePolicyServiceMock ??
      ({ getOrCreate: jest.fn().mockResolvedValue({ baseDaysPerYear: 12, seniorityYearsPerBonusDay: 5 }) } as {
        getOrCreate: jest.Mock;
      });
    const workCalendarServiceMock = {
      loadBook: jest.fn(async (_org: string, from: string, to: string) => buildCalendarBook(opts.schedule ?? ALL_DAYS, opts.events ?? [], from, to)),
    };
    const periodLockServiceMock = { assertOpen: opts.assertOpen ?? jest.fn().mockResolvedValue(undefined) };

    const service = new LeaveRequestsService(
      dataSourceMock as any,
      leaveRequestRepoMock as any,
      adjustmentRepoMock as any,
      outboxServiceMock as any,
      leavePolicyServiceMock as any,
      workCalendarServiceMock as any,
      periodLockServiceMock as any,
    );

    return {
      service,
      dataSourceMock,
      managerMock,
      leaveRequestRepoMock,
      adjustmentRepoMock,
      outboxServiceMock,
      leavePolicyServiceMock,
      workCalendarServiceMock,
      periodLockServiceMock,
      dimUserRepoMock,
    };
  }

  /** 04/11/2026: manager tra du lieu theo entity - chi nhung gi can cho so du phep. */
  function balanceManager(data: { requests?: unknown[]; adjustments?: Array<{ year: number; days: number }>; joinedAt?: string | null; locked?: unknown }) {
    return {
      find: jest.fn(async (entity: unknown) => (entity === LeaveRequest ? (data.requests ?? []) : entity === LeaveBalanceAdjustment ? (data.adjustments ?? []) : [])),
      findOne: jest.fn(async (entity: unknown, options: { lock?: unknown }) => {
        if (entity === DimUser) return data.joinedAt === undefined ? null : { joinedAt: data.joinedAt };
        return options?.lock ? (data.locked ?? null) : null;
      }),
      create: jest.fn((_entityClass: unknown, value: unknown) => value),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };
  }

  const NEXT_YEAR = Number(toGmt7DateString(new Date()).slice(0, 4)) + 1;

  function annual(startDate: string, endDate: string, overrides: Record<string, unknown> = {}) {
    return { id: `lr-${startDate}`, startDate, endDate, status: LeaveRequestStatus.APPROVED, leaveType: LeaveType.ANNUAL, ...overrides };
  }

  describe('create', () => {
    it('tao yeu cau nghi phep moi thanh cong voi trang thai PENDING, ghi outbox event LEAVE_REQUEST_CREATED', async () => {
      const { service, outboxServiceMock } = createService();
      const dto: CreateLeaveRequestDto = {
        startDate: futureDateStr(1),
        endDate: futureDateStr(3),
        reason: 'Nghi kham benh',
      };

      const result = await service.create(organizationId, userId, dto);

      expect(result.status).toBe(LeaveRequestStatus.PENDING);
      expect(result.organizationId).toBe(organizationId);
      expect(result.userId).toBe(userId);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: EVENT_TYPES.LEAVE_REQUEST_CREATED }),
      );
    });

    it('tao yeu cau nghi phep thanh cong khi ngay bat dau la HOM NAY (bien, khong phai "qua khu")', async () => {
      const { service } = createService();
      const dto: CreateLeaveRequestDto = { startDate: futureDateStr(0), endDate: futureDateStr(0), reason: 'x' };

      const result = await service.create(organizationId, userId, dto);

      expect(result.status).toBe(LeaveRequestStatus.PENDING);
    });

    it('tu choi khi ngay bat dau sau ngay ket thuc, khong mo transaction', async () => {
      const { service, dataSourceMock } = createService();
      const dto: CreateLeaveRequestDto = { startDate: futureDateStr(5), endDate: futureDateStr(1), reason: 'x' };

      await expect(service.create(organizationId, userId, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_DATE_RANGE_INVALID }),
      });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    // 15/09/2026 (sua loi thuc te - phan hoi cua GVHD): "chon nghi phep cho 1 ngay DA QUA van tao
    // duoc yeu cau" - truoc ban sua service.ts khong co kiem tra nao, test nay se FAIL tren code cu.
    it('tu choi khi ngay bat dau o QUA KHU, khong mo transaction', async () => {
      const { service, dataSourceMock } = createService();
      const dto: CreateLeaveRequestDto = { startDate: '2020-01-01', endDate: '2020-01-03', reason: 'x' };

      await expect(service.create(organizationId, userId, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_START_DATE_IN_PAST }),
      });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    // 04/11/2026: loai nghi tach khoi reason; client cu khong gui leaveType van hoat dong.
    describe('loai nghi', () => {
      const base = () => ({ startDate: futureDateStr(1), endDate: futureDateStr(1) });

      it('leaveType gui rieng duoc luu, reason giu nguyen, leaveType thang ca khi reason co tien to khac', async () => {
        const { service } = createService();
        const result = await service.create(organizationId, userId, { ...base(), reason: '[SICK] x', leaveType: LeaveType.UNPAID });
        expect(result.leaveType).toBe(LeaveType.UNPAID);
        expect(result.reason).toBe('[SICK] x');
      });

      it('thieu leaveType: suy tu tien to reason, khong co tien to thi la phep nam', async () => {
        const { service } = createService();
        expect((await service.create(organizationId, userId, { ...base(), reason: '[SICK] Sốt' })).leaveType).toBe(LeaveType.SICK);
        expect((await service.create(organizationId, userId, { ...base(), reason: '[UNPAID] Về quê' })).leaveType).toBe(LeaveType.UNPAID);
        expect((await service.create(organizationId, userId, { ...base(), reason: 'Việc gia đình' })).leaveType).toBe(LeaveType.ANNUAL);
      });

      it('ngay co phan gio ISO duoc chuan hoa ve YYYY-MM-DD truoc khi luu va phat su kien', async () => {
        const day = futureDateStr(1);
        const { service, outboxServiceMock } = createService();
        const result = await service.create(organizationId, userId, { startDate: `${day}T00:00:00.000Z`, endDate: `${day}T10:00:00.000Z`, reason: 'x' });
        expect(result.startDate).toBe(day);
        expect(result.endDate).toBe(day);
        expect(outboxServiceMock.record.mock.calls[0][1].payload).toMatchObject({ startDate: day, endDate: day });
      });
    });

    describe('LEAVE_NO_WORKING_DAYS - dem theo lich cong ty', () => {
      const mondayOnly: WorkScheduleRules = { ...ALL_DAYS, workingWeekdays: [1] };
      function nextWeekday(target: number): string {
        let date = futureDateStr(1);
        while (weekdayOf(date) !== target) date = addDays(date, 1);
        return date;
      }

      it('khoang chi gom ngay nghi tuan (Thu 3 -> Chu nhat) -> bi chan, khong mo giao dich', async () => {
        const start = nextWeekday(2);
        const { service, dataSourceMock } = createService({ schedule: mondayOnly });
        await expect(service.create(organizationId, userId, { startDate: start, endDate: addDays(start, 5), reason: 'x' })).rejects.toMatchObject({
          response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_NO_WORKING_DAYS }),
        });
        expect(dataSourceMock.transaction).not.toHaveBeenCalled();
      });

      it('khoang chi gom ngay le -> bi chan du la ngay lam viec theo tuan', async () => {
        const day = futureDateStr(2);
        const { service } = createService({ events: [{ type: CalendarEventType.HOLIDAY, title: 'Le', startDate: day, endDate: day }] });
        await expect(service.create(organizationId, userId, { startDate: day, endDate: day, reason: 'x' })).rejects.toMatchObject({
          response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_NO_WORKING_DAYS }),
        });
      });

      it('ngay nghi tuan co lam bu -> tao duoc', async () => {
        const start = nextWeekday(2);
        const { service } = createService({
          schedule: mondayOnly,
          events: [{ type: CalendarEventType.MAKEUP_WORKDAY, title: 'Bu', startDate: start, endDate: start }],
        });
        await expect(service.create(organizationId, userId, { startDate: start, endDate: start, reason: 'x' })).resolves.toMatchObject({ startDate: start });
      });

      it('ap dung cho moi loai nghi, ke ca loai khong tru phep', async () => {
        const day = futureDateStr(2);
        const { service } = createService({ events: [{ type: CalendarEventType.HOLIDAY, title: 'Le', startDate: day, endDate: day }] });
        await expect(service.create(organizationId, userId, { startDate: day, endDate: day, reason: 'x', leaveType: LeaveType.SICK })).rejects.toMatchObject({
          response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_NO_WORKING_DAYS }),
        });
      });
    });

    describe('LEAVE_OVERLAP', () => {
      it('khoa theo nguoi truoc roi moi kiem tra trung, dieu kien gom ca 2 dau mut va chi PENDING/APPROVED', async () => {
        const start = futureDateStr(3);
        const end = futureDateStr(5);
        const { service, managerMock } = createService();

        await service.create(organizationId, userId, { startDate: start, endDate: end, reason: 'x' });

        expect(managerMock.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [`leave:${organizationId}:${userId}`]);
        expect(managerMock.query.mock.invocationCallOrder[0]).toBeLessThan(managerMock.findOne.mock.invocationCallOrder[0]);
        const where = managerMock.findOne.mock.calls[0][1].where;
        expect(where).toMatchObject({ organizationId, userId });
        expect(where.status.value).toEqual([LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED]);
        // startDate <= cuoi don moi va endDate >= dau don moi: trung dung 1 ngay dau hoac cuoi van tinh la trung.
        expect(where.startDate.type).toBe('lessThanOrEqual');
        expect(where.startDate.value).toBe(end);
        expect(where.endDate.type).toBe('moreThanOrEqual');
        expect(where.endDate.value).toBe(start);
      });

      it('co don trung -> 409, khong luu, khong ghi outbox', async () => {
        const { service, managerMock, outboxServiceMock } = createService({
          managerMock: { findOne: jest.fn().mockResolvedValue({ id: 'lr-x' }), save: jest.fn() },
        });
        await expect(service.create(organizationId, userId, { startDate: futureDateStr(1), endDate: futureDateStr(1), reason: 'x', leaveType: LeaveType.SICK })).rejects.toMatchObject({
          status: 409,
          response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_OVERLAP }),
        });
        expect(managerMock.save).not.toHaveBeenCalled();
        expect(outboxServiceMock.record).not.toHaveBeenCalled();
      });
    });

    describe('LEAVE_BALANCE_EXCEEDED', () => {
      const y = NEXT_YEAR;
      const policy2 = () => ({ getOrCreate: jest.fn().mockResolvedValue({ baseDaysPerYear: 2, seniorityYearsPerBonusDay: 5 }) });

      it('da duyet + dang cho + don nay > thuc huong -> bi chan', async () => {
        const { service, managerMock } = createService({
          leavePolicyServiceMock: policy2(),
          managerMock: balanceManager({ requests: [annual(`${y}-03-02`, `${y}-03-02`), annual(`${y}-03-03`, `${y}-03-03`, { status: LeaveRequestStatus.PENDING })] }),
        });
        await expect(service.create(organizationId, userId, { startDate: `${y}-04-01`, endDate: `${y}-04-01`, reason: 'x' })).rejects.toMatchObject({
          response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_BALANCE_EXCEEDED, errorParams: { year: y, requestedDays: 1, remainingDays: 0 } }),
        });
        expect(managerMock.save).not.toHaveBeenCalled();
      });

      it('vua du so du -> tao duoc', async () => {
        const { service } = createService({
          leavePolicyServiceMock: policy2(),
          managerMock: balanceManager({ requests: [annual(`${y}-03-02`, `${y}-03-02`)] }),
        });
        await expect(service.create(organizationId, userId, { startDate: `${y}-04-01`, endDate: `${y}-04-01`, reason: 'x' })).resolves.toBeDefined();
      });

      it('dieu chinh duong cong them vao thuc huong', async () => {
        const { service } = createService({
          leavePolicyServiceMock: policy2(),
          managerMock: balanceManager({ requests: [annual(`${y}-03-02`, `${y}-03-03`)], adjustments: [{ year: y, days: 1 }] }),
        });
        await expect(service.create(organizationId, userId, { startDate: `${y}-04-01`, endDate: `${y}-04-01`, reason: 'x' })).resolves.toBeDefined();
      });

      it('nghi om va nghi khong luong khong xet so du, khong doc chinh sach', async () => {
        for (const leaveType of [LeaveType.SICK, LeaveType.UNPAID]) {
          const leavePolicyServiceMock = { getOrCreate: jest.fn() };
          const manager = balanceManager({ adjustments: [{ year: y, days: -100 }] });
          const { service } = createService({ leavePolicyServiceMock, managerMock: manager });
          await expect(service.create(organizationId, userId, { startDate: `${y}-04-01`, endDate: `${y}-04-10`, reason: 'x', leaveType })).resolves.toBeDefined();
          expect(leavePolicyServiceMock.getOrCreate).not.toHaveBeenCalled();
          expect(manager.find).not.toHaveBeenCalled();
        }
      });

      it('don nghi om da co khong an vao so du cua don phep nam moi', async () => {
        const { service } = createService({
          leavePolicyServiceMock: policy2(),
          managerMock: balanceManager({ requests: [annual(`${y}-03-02`, `${y}-03-06`, { leaveType: LeaveType.SICK })] }),
        });
        await expect(service.create(organizationId, userId, { startDate: `${y}-04-01`, endDate: `${y}-04-02`, reason: 'x' })).resolves.toBeDefined();
      });

      it('don vat qua 2 nam: xet rieng tung nam, nam sau het phep van bi chan du nam truoc con', async () => {
        const { service } = createService({ managerMock: balanceManager({ adjustments: [{ year: y + 1, days: -11 }] }) });
        await expect(service.create(organizationId, userId, { startDate: `${y}-12-30`, endDate: `${y + 1}-01-02`, reason: 'x' })).rejects.toMatchObject({
          response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_BALANCE_EXCEEDED, errorParams: { year: y + 1, requestedDays: 2, remainingDays: 1 } }),
        });
      });

      it('don vat qua 2 nam: nam dau het phep cung bi chan', async () => {
        const { service } = createService({ managerMock: balanceManager({ adjustments: [{ year: y, days: -11 }] }) });
        await expect(service.create(organizationId, userId, { startDate: `${y}-12-30`, endDate: `${y + 1}-01-02`, reason: 'x' })).rejects.toMatchObject({
          response: expect.objectContaining({ errorParams: expect.objectContaining({ year: y }) }),
        });
      });

      it('nam chi bi cham boi ngay le khong bi xet, du so du nam do da am', async () => {
        const { service } = createService({
          events: [{ type: CalendarEventType.HOLIDAY, title: 'Tet Duong lich', startDate: `${y + 1}-01-01`, endDate: `${y + 1}-01-01` }],
          managerMock: balanceManager({ adjustments: [{ year: y + 1, days: -100 }] }),
        });
        await expect(service.create(organizationId, userId, { startDate: `${y}-12-31`, endDate: `${y + 1}-01-01`, reason: 'x' })).resolves.toBeDefined();
      });

      it('le nam trong don khong bi tinh vao so ngay xin', async () => {
        const { service } = createService({
          leavePolicyServiceMock: policy2(),
          events: [{ type: CalendarEventType.HOLIDAY, title: 'Le', startDate: `${y}-04-02`, endDate: `${y}-04-02` }],
        });
        await expect(service.create(organizationId, userId, { startDate: `${y}-04-01`, endDate: `${y}-04-03`, reason: 'x' })).resolves.toBeDefined();
      });

      it('khong co joinedAt: tham nien = 0; co joinedAt lau nam thi duoc cong', async () => {
        const request = { startDate: `${y}-04-01`, endDate: `${y}-04-03`, reason: 'x' };
        const without = createService({ leavePolicyServiceMock: policy2(), managerMock: balanceManager({}) });
        await expect(without.service.create(organizationId, userId, request)).rejects.toMatchObject({
          response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_BALANCE_EXCEEDED }),
        });
        const veteran = createService({ leavePolicyServiceMock: policy2(), managerMock: balanceManager({ joinedAt: '2000-01-01' }) });
        await expect(veteran.service.create(organizationId, userId, request)).resolves.toBeDefined();
      });
    });
  });

  describe('approve/reject - khoa pessimistic_write + re-check BEN TRONG transaction', () => {
    it('approve thanh cong: khoa row bang pessimistic_write, cap nhat status/approverId/decisionNote/decidedAt, ghi outbox LEAVE_REQUEST_APPROVED', async () => {
      const preCheck = pendingRequest();
      const locked = pendingRequest();
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(locked),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      };
      const leaveRequestRepoMock = { findOne: jest.fn().mockResolvedValue(preCheck) };
      const { service, outboxServiceMock } = createService({ leaveRequestRepoMock, managerMock });
      const dto: DecideLeaveRequestDto = { decisionNote: 'Duyet' };

      const result = await service.approve(organizationId, leaveRequestId, approverId, dto);

      expect(result.status).toBe(LeaveRequestStatus.APPROVED);
      expect(result.approverId).toBe(approverId);
      expect(result.decisionNote).toBe('Duyet');
      expect(result.decidedAt).toBeInstanceOf(Date);
      expect(managerMock.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EVENT_TYPES.LEAVE_REQUEST_APPROVED,
          payload: expect.objectContaining({ leaveRequestId, userId, actorId: approverId }),
        }),
      );
    });

    it('reject thanh cong: khoa row bang pessimistic_write, cap nhat status REJECTED, ghi outbox LEAVE_REQUEST_REJECTED', async () => {
      const preCheck = pendingRequest();
      const locked = pendingRequest();
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(locked),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      };
      const leaveRequestRepoMock = { findOne: jest.fn().mockResolvedValue(preCheck) };
      const { service, outboxServiceMock } = createService({ leaveRequestRepoMock, managerMock });

      const result = await service.reject(organizationId, leaveRequestId, approverId, {});

      expect(result.status).toBe(LeaveRequestStatus.REJECTED);
      expect(result.decisionNote).toBeNull();
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: EVENT_TYPES.LEAVE_REQUEST_REJECTED }),
      );
    });

    it('bao NotFoundException khi khong tim thay yeu cau tu pre-check, khong mo transaction', async () => {
      const leaveRequestRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service, dataSourceMock } = createService({ leaveRequestRepoMock });

      await expect(service.approve(organizationId, leaveRequestId, approverId, {})).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_REQUEST_NOT_FOUND }),
      });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    it('tu choi ngay tu pre-check neu yeu cau da duoc xu ly truoc do (khong con PENDING) - guard chong quyet dinh 2 lan', async () => {
      const alreadyDecided = pendingRequest({ status: LeaveRequestStatus.APPROVED });
      const leaveRequestRepoMock = { findOne: jest.fn().mockResolvedValue(alreadyDecided) };
      const { service, dataSourceMock } = createService({ leaveRequestRepoMock });

      await expect(service.reject(organizationId, leaveRequestId, approverId, {})).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_REQUEST_ALREADY_DECIDED }),
      });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    it('tu choi neu row vua duoc khoa BEN TRONG transaction da bi 1 Manager khac quyet dinh truoc (stale pre-check khong con dung, day la ly do can khoa)', async () => {
      // Pre-check (khong khoa, dau ham) doc snapshot cu la PENDING -> tuong hop le de tien hanh.
      // Nhung giua luc pre-check va luc khoa, 1 Manager khac da REJECT xong yeu cau nay - phai
      // phat hien lai BEN TRONG transaction (sau khi khoa), khong duoc tin snapshot cu.
      const preCheck = pendingRequest();
      const lockedAfterRace = pendingRequest({ status: LeaveRequestStatus.REJECTED, approverId: 'other-manager' });
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(lockedAfterRace),
        save: jest.fn(),
      };
      const leaveRequestRepoMock = { findOne: jest.fn().mockResolvedValue(preCheck) };
      const { service } = createService({ leaveRequestRepoMock, managerMock });

      await expect(service.approve(organizationId, leaveRequestId, approverId, {})).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_REQUEST_ALREADY_DECIDED }),
      });
      // Khong duoc ap dung quyet dinh moi khi re-check (sau khoa) that bai.
      expect(managerMock.save).not.toHaveBeenCalled();
    });

    it('bao NotFoundException neu row bi xoa giua luc pre-check va luc khoa (phong thu, khong nem loi khac)', async () => {
      const preCheck = pendingRequest();
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn(),
      };
      const leaveRequestRepoMock = { findOne: jest.fn().mockResolvedValue(preCheck) };
      const { service } = createService({ leaveRequestRepoMock, managerMock });

      await expect(service.approve(organizationId, leaveRequestId, approverId, {})).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_REQUEST_NOT_FOUND }),
      });
      expect(managerMock.save).not.toHaveBeenCalled();
    });

    // 04/11/2026: kiem tra lai so du khi duyet va chan khi thang da khoa ky cong.
    describe('kiem tra lai so du khi duyet', () => {
      const y = NEXT_YEAR;
      const three = () => pendingRequest({ startDate: `${y}-03-02`, endDate: `${y}-03-04` });
      const repo = (row: unknown) => ({ findOne: jest.fn().mockResolvedValue(row) });
      const policy = (baseDaysPerYear: number) => ({ getOrCreate: jest.fn().mockResolvedValue({ baseDaysPerYear, seniorityYearsPerBonusDay: 5 }) });

      it('khong tinh chinh don do 2 lan: dung bang so du van duyet duoc', async () => {
        const row = three();
        const { service } = createService({
          leaveRequestRepoMock: repo(row),
          leavePolicyServiceMock: policy(3),
          managerMock: balanceManager({ requests: [row], locked: three() }),
        });
        await expect(service.approve(organizationId, leaveRequestId, approverId, {})).resolves.toMatchObject({ status: LeaveRequestStatus.APPROVED });
      });

      it('cong them don cho khac vuot so du -> bi chan, khong luu', async () => {
        const row = three();
        const other = annual(`${y}-05-04`, `${y}-05-04`, { status: LeaveRequestStatus.PENDING });
        const manager = balanceManager({ requests: [row, other], locked: three() });
        const { service } = createService({ leaveRequestRepoMock: repo(row), leavePolicyServiceMock: policy(3), managerMock: manager });
        await expect(service.approve(organizationId, leaveRequestId, approverId, {})).rejects.toMatchObject({
          response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_BALANCE_EXCEEDED }),
        });
        expect(manager.save).not.toHaveBeenCalled();
      });

      it('chinh sach bi giam sau khi tao don -> bi chan khi duyet', async () => {
        const row = three();
        const { service } = createService({ leaveRequestRepoMock: repo(row), leavePolicyServiceMock: policy(2), managerMock: balanceManager({ requests: [row], locked: three() }) });
        await expect(service.approve(organizationId, leaveRequestId, approverId, {})).rejects.toMatchObject({
          response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_BALANCE_EXCEEDED }),
        });
      });

      it('duyet don nghi om khong xet so du, khong doc chinh sach', async () => {
        const row = pendingRequest({ startDate: `${y}-03-02`, endDate: `${y}-03-20`, leaveType: LeaveType.SICK });
        const leavePolicyServiceMock = { getOrCreate: jest.fn() };
        const { service } = createService({ leaveRequestRepoMock: repo(row), leavePolicyServiceMock, managerMock: balanceManager({ requests: [row], locked: { ...row } }) });
        await expect(service.approve(organizationId, leaveRequestId, approverId, {})).resolves.toMatchObject({ status: LeaveRequestStatus.APPROVED });
        expect(leavePolicyServiceMock.getOrCreate).not.toHaveBeenCalled();
      });

      it('tu choi khong xet so du, ke ca khi da am', async () => {
        const row = three();
        const { service } = createService({ leaveRequestRepoMock: repo(row), leavePolicyServiceMock: policy(0), managerMock: balanceManager({ requests: [row], locked: three() }) });
        await expect(service.reject(organizationId, leaveRequestId, approverId, {})).resolves.toMatchObject({ status: LeaveRequestStatus.REJECTED });
      });

      it('duyet giu khoa theo nguoi truoc khoa dong; tu choi khong can khoa theo nguoi', async () => {
        const row = three();
        const manager = { ...balanceManager({ requests: [row], locked: three() }), query: jest.fn().mockResolvedValue([]) };
        const { service } = createService({ leaveRequestRepoMock: repo(row), managerMock: manager });
        await service.approve(organizationId, leaveRequestId, approverId, {});
        expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [`leave:${organizationId}:${userId}`]);
        expect(manager.query.mock.invocationCallOrder[0]).toBeLessThan(manager.findOne.mock.invocationCallOrder[0]);

        const rejectManager = { ...balanceManager({ locked: three() }), query: jest.fn() };
        const rejecting = createService({ leaveRequestRepoMock: repo(three()), managerMock: rejectManager });
        await rejecting.service.reject(organizationId, leaveRequestId, approverId, {});
        expect(rejectManager.query).not.toHaveBeenCalled();
      });
    });

    describe('assertOpen - ky cong da khoa', () => {
      const locked = () => jest.fn().mockRejectedValue(Object.assign(new Error('locked'), { response: { errorCode: ERROR_CODES.TIMESHEET_PERIOD_LOCKED } }));
      const row = () => pendingRequest({ startDate: '2026-01-30', endDate: '2026-03-02' });

      it.each(['approve', 'reject'] as const)('%s bi chan, khong luu, khong ghi outbox', async (action) => {
        const save = jest.fn();
        const { service, outboxServiceMock } = createService({
          leaveRequestRepoMock: { findOne: jest.fn().mockResolvedValue(row()) },
          assertOpen: locked(),
          managerMock: { findOne: jest.fn().mockResolvedValue(row()), save },
        });
        await expect(service[action](organizationId, leaveRequestId, approverId, {})).rejects.toMatchObject({
          response: { errorCode: ERROR_CODES.TIMESHEET_PERIOD_LOCKED },
        });
        expect(save).not.toHaveBeenCalled();
        expect(outboxServiceMock.record).not.toHaveBeenCalled();
      });

      it('hoi du moi thang don cham toi (ca thang giua), trong cung giao dich', async () => {
        const { service, periodLockServiceMock, managerMock } = createService({
          leaveRequestRepoMock: { findOne: jest.fn().mockResolvedValue(row()) },
          managerMock: { findOne: jest.fn().mockResolvedValue(row()), save: jest.fn((entity: unknown) => Promise.resolve(entity)) },
          leavePolicyServiceMock: { getOrCreate: jest.fn().mockResolvedValue({ baseDaysPerYear: 100, seniorityYearsPerBonusDay: 5 }) },
        });
        await service.approve(organizationId, leaveRequestId, approverId, {});
        expect(periodLockServiceMock.assertOpen).toHaveBeenCalledWith(organizationId, monthProbes('2026-01-30', '2026-03-02'), managerMock);
      });

      it('huy don dang cho van duoc khi ky da khoa', async () => {
        const { service, periodLockServiceMock } = createService({
          leaveRequestRepoMock: { findOne: jest.fn().mockResolvedValue(row()) },
          assertOpen: locked(),
          managerMock: { findOne: jest.fn().mockResolvedValue(row()), save: jest.fn((entity: unknown) => Promise.resolve(entity)) },
        });
        await expect(service.cancel(organizationId, leaveRequestId, userId)).resolves.toMatchObject({ status: LeaveRequestStatus.REJECTED });
        expect(periodLockServiceMock.assertOpen).not.toHaveBeenCalled();
      });
    });
  });

  /**
   * 03/10/2026: findAll() (GET /leave-requests, PERMISSIONS.LEAVE_REQUEST_VIEW) truoc gio KHONG co
   * test nao, du da ho tro san query.userId (mirror dung AttendanceQueryDto.userId/
   * AttendanceService.findAll() - xem LeaveRequestQueryDto). Bo sung test de "chot" hanh vi nay:
   * Manager/Org Admin truyen userId MA KHONG truyen status se nhan DUOC CA 3 trang thai (PENDING/
   * APPROVED/REJECTED) cua 1 nhan vien cu the - day CHINH LA "lich su nghi phep day du theo tung
   * nhan vien" (khac voi GET /leave-requests/me chi tra ve cua CHINH nguoi goi).
   */
  describe('findAll (toan to chuc, loc theo userId/status - mirror AttendanceService.findAll())', () => {
    it('loc theo userId, KHONG truyen status -> tra ve moi trang thai (lich su day du cua 1 nhan vien)', async () => {
      const rows = [
        pendingRequest({ id: 'lr-1', status: LeaveRequestStatus.APPROVED }),
        pendingRequest({ id: 'lr-2', status: LeaveRequestStatus.REJECTED }),
      ];
      const leaveRequestRepoMock = { findOne: jest.fn(), findAndCount: jest.fn().mockResolvedValue([rows, 2]) };
      const { service } = createService({ leaveRequestRepoMock } as any);

      const result = await service.findAll(organizationId, { userId, page: 1, limit: 20 });

      expect(leaveRequestRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId, userId } }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 2 });
    });

    it('khong truyen userId/status -> loc CHI theo organizationId (danh sach toan to chuc)', async () => {
      const leaveRequestRepoMock = { findOne: jest.fn(), findAndCount: jest.fn().mockResolvedValue([[], 0]) };
      const { service } = createService({ leaveRequestRepoMock } as any);

      await service.findAll(organizationId, { page: 1, limit: 20 });

      expect(leaveRequestRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId } }),
      );
    });

    it('truyen ca userId lan status -> loc ca 2 dieu kien cung luc', async () => {
      const leaveRequestRepoMock = { findOne: jest.fn(), findAndCount: jest.fn().mockResolvedValue([[], 0]) };
      const { service } = createService({ leaveRequestRepoMock } as any);

      await service.findAll(organizationId, { userId, status: LeaveRequestStatus.PENDING, page: 1, limit: 20 });

      expect(leaveRequestRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId, userId, status: LeaveRequestStatus.PENDING } }),
      );
    });
  });

  // 04/11/2026: so ngay cua don tinh theo lich cong ty, nap lich 1 lan cho ca trang.
  describe('workingDays trong API doc don', () => {
    const MON_FRI: WorkScheduleRules = { ...ALL_DAYS, workingWeekdays: [1, 2, 3, 4, 5] };
    const rows = () => [
      pendingRequest({ id: 'a', startDate: '2025-06-02', endDate: '2025-06-08' }),
      pendingRequest({ id: 'b', startDate: '2025-05-31', endDate: '2025-06-02' }),
    ];
    const holiday = { type: CalendarEventType.HOLIDAY, title: 'Le', startDate: '2025-06-04', endDate: '2025-06-04' };

    it('findMine: tinh cho tung don, tru cuoi tuan va le, chi nap lich 1 lan cho ca trang', async () => {
      const leaveRequestRepoMock = { findOne: jest.fn(), findAndCount: jest.fn().mockResolvedValue([rows(), 2]) };
      const { service, workCalendarServiceMock } = createService({ leaveRequestRepoMock, schedule: MON_FRI, events: [holiday] });

      const result = await service.findMine(organizationId, userId, { page: 1, limit: 20 });

      expect(result.data.map((row) => row.workingDays)).toEqual([4, 1]);
      expect(workCalendarServiceMock.loadBook).toHaveBeenCalledTimes(1);
      expect(workCalendarServiceMock.loadBook).toHaveBeenCalledWith(organizationId, '2025-05-31', '2025-06-08');
    });

    it('findAll cung tra workingDays, trang rong khong nap lich', async () => {
      const leaveRequestRepoMock = { findOne: jest.fn(), findAndCount: jest.fn().mockResolvedValueOnce([rows(), 2]).mockResolvedValueOnce([[], 0]) };
      const { service, workCalendarServiceMock } = createService({ leaveRequestRepoMock, schedule: MON_FRI });

      expect((await service.findAll(organizationId, { page: 1, limit: 20 })).data.map((row) => row.workingDays)).toEqual([5, 1]);
      workCalendarServiceMock.loadBook.mockClear();
      await service.findAll(organizationId, { page: 1, limit: 20 });
      expect(workCalendarServiceMock.loadBook).not.toHaveBeenCalled();
    });
  });

  /**
   * 22/09/2026: test cho tinh nang moi - so du phep (getMyBalance()), theo de xuat cua Tien "Tính
   * phép theo Luật LĐ VN".
   *
   * 04/11/2026: may chu tinh tron so du, dem ngay theo lich cong ty - cac kiem tra cu duoc giu va siet
   * chat thanh so cu the; phep tinh chi tiet o leave-balance.util.spec.ts.
   */
  describe('getMyBalance', () => {
    const year = Number(toGmt7DateString(new Date()).slice(0, 4));
    const MON_FRI: WorkScheduleRules = { ...ALL_DAYS, workingWeekdays: [1, 2, 3, 4, 5] };
    function firstMonday(y: number): string {
      let date = `${y}-06-01`;
      while (weekdayOf(date) !== 1) date = addDays(date, 1);
      return date;
    }

    it('cong don dung so ngay lam viec (bo qua Thu 7/CN) cua cac don APPROVED trong nam hien tai', async () => {
      const monday = firstMonday(year);
      const { service } = createService({ schedule: MON_FRI, managerMock: balanceManager({ requests: [annual(monday, addDays(monday, 6))] }) });

      const result = await service.getMyBalance(organizationId, userId);

      expect(result.year).toBe(year);
      expect(result.baseDaysPerYear).toBe(12);
      expect(result.seniorityYearsPerBonusDay).toBe(5);
      expect(result.usedDays).toBe(5);
      expect(result).toMatchObject({ pendingDays: 0, adjustmentDays: 0, seniorityBonusDays: 0, entitledDays: 12, remainingDays: 7 });
    });

    it('cat khoang ngay ve trong nam hien tai neu don nghi vat qua giao thua nam', async () => {
      // 30/12 nam truoc -> 02/01 nam nay: chi phan tu 01/01 den 02/01 nam nay duoc tinh.
      const { service } = createService({ managerMock: balanceManager({ requests: [annual(`${year - 1}-12-30`, `${year}-01-02`)] }) });

      const result = await service.getMyBalance(organizationId, userId);

      expect(result.usedDays).toBe(2);
    });

    it('tra ve usedDays = 0 khi khong co don APPROVED nao trong nam hien tai', async () => {
      const { service } = createService({ managerMock: balanceManager({}) });

      const result = await service.getMyBalance(organizationId, userId);

      expect(result.usedDays).toBe(0);
      expect(result.remainingDays).toBe(12);
    });

    it('tach da duyet/dang cho, usedDays chi tinh loai tru so du, cong dieu chinh va tham nien', async () => {
      const { service } = createService({
        managerMock: balanceManager({
          joinedAt: `${year - 11}-01-01`,
          adjustments: [
            { year, days: 3 },
            { year, days: -1 },
          ],
          requests: [
            annual(`${year}-02-02`, `${year}-02-03`),
            annual(`${year}-03-02`, `${year}-03-02`, { status: LeaveRequestStatus.PENDING }),
            annual(`${year}-04-01`, `${year}-04-10`, { leaveType: LeaveType.SICK }),
            annual(`${year}-05-01`, `${year}-05-10`, { leaveType: LeaveType.UNPAID }),
          ],
        }),
      });

      await expect(service.getMyBalance(organizationId, userId)).resolves.toMatchObject({
        usedDays: 2,
        pendingDays: 1,
        adjustmentDays: 2,
        seniorityBonusDays: 2,
        entitledDays: 16,
        remainingDays: 13,
      });
    });

    it('chi nap lich va dieu chinh cua nam hien tai', async () => {
      const manager = balanceManager({});
      const { service, workCalendarServiceMock } = createService({ managerMock: manager });
      await service.getMyBalance(organizationId, userId);
      expect(workCalendarServiceMock.loadBook).toHaveBeenCalledWith(organizationId, `${year}-01-01`, `${year}-12-31`);
      const adjustmentCall = manager.find.mock.calls.find(([entity]) => entity === LeaveBalanceAdjustment) as unknown as [unknown, { where: { year: { value: number[] } } }];
      expect(adjustmentCall[1].where.year.value).toEqual([year]);
    });
  });

  // 04/11/2026: dieu chinh so phep - moi sai sot deu tra cung 1 ma, chi them moi.
  describe('createBalanceAdjustment / findBalanceAdjustments', () => {
    const member = '22222222-2222-4222-8222-222222222222';
    const valid = () => ({ userId: member, year: 2026, days: 2, note: 'Phep ton 2025' });

    it('hop le: luu kem nguoi tao, ghi chu duoc cat khoang trang', async () => {
      const { service, adjustmentRepoMock, dimUserRepoMock } = createService();
      await service.createBalanceAdjustment(organizationId, approverId, { ...valid(), note: '  Phep ton  ' });
      expect(dimUserRepoMock.findOne).toHaveBeenCalledWith({ where: { userId: member, organizationId } });
      expect(adjustmentRepoMock.save).toHaveBeenCalledWith({ organizationId, userId: member, year: 2026, days: 2, note: 'Phep ton', createdByUserId: approverId });
    });

    it('so ngay am duoc', async () => {
      const { service, adjustmentRepoMock } = createService();
      await service.createBalanceAdjustment(organizationId, approverId, { ...valid(), days: -3 });
      expect(adjustmentRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ days: -3 }));
    });

    it.each([
      ['days = 0', { days: 0 }],
      ['days khong nguyen', { days: 1.5 }],
      ['days qua lon', { days: 367 }],
      ['days kieu chuoi', { days: '2' }],
      ['note rong', { note: '' }],
      ['note toan khoang trang', { note: '   ' }],
      ['thieu note', { note: undefined }],
      ['year khong nguyen', { year: 2026.5 }],
      ['year ngoai khoang', { year: 1999 }],
      ['userId khong phai uuid', { userId: 'abc' }],
    ])('%s -> LEAVE_ADJUSTMENT_INVALID, khong truy van DB', async (_name, patch) => {
      const { service, adjustmentRepoMock, dimUserRepoMock } = createService();
      await expect(service.createBalanceAdjustment(organizationId, approverId, { ...valid(), ...(patch as object) } as any)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_ADJUSTMENT_INVALID }),
      });
      expect(dimUserRepoMock.findOne).not.toHaveBeenCalled();
      expect(adjustmentRepoMock.save).not.toHaveBeenCalled();
    });

    it('userId khong thuoc to chuc -> LEAVE_ADJUSTMENT_INVALID', async () => {
      const { service, adjustmentRepoMock } = createService({ dimUserFindOne: jest.fn().mockResolvedValue(null) });
      await expect(service.createBalanceAdjustment(organizationId, approverId, valid())).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_ADJUSTMENT_INVALID }),
      });
      expect(adjustmentRepoMock.save).not.toHaveBeenCalled();
    });

    it('danh sach loc theo to chuc va bo loc tuy chon', async () => {
      const { service, adjustmentRepoMock } = createService();
      await service.findBalanceAdjustments(organizationId, { userId: member, year: 2026 });
      expect(adjustmentRepoMock.find.mock.calls[0][0].where).toEqual({ organizationId, userId: member, year: 2026 });
      await service.findBalanceAdjustments(organizationId, {});
      expect(adjustmentRepoMock.find.mock.calls[1][0].where).toEqual({ organizationId });
    });
  });
});
