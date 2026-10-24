import { ERROR_CODES, EVENT_TYPES, LeaveRequestStatus } from '@app/common-dto';
import { toGmt7DateString } from '../attendance/attendance-date.util';
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
      approverId: null,
      decisionNote: null,
      decidedAt: null,
      ...overrides,
    };
  }

  function createService(opts: {
    leaveRequestRepoMock?: { findOne: jest.Mock; createQueryBuilder?: jest.Mock };
    managerMock?: { findOne?: jest.Mock; create?: jest.Mock; save: jest.Mock };
    leavePolicyServiceMock?: { getOrCreate: jest.Mock };
  } = {}) {
    const managerMock =
      opts.managerMock ??
      ({
        create: jest.fn((_entityClass: unknown, data: unknown) => data),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      } as { create: jest.Mock; save: jest.Mock });
    const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
    const leaveRequestRepoMock = opts.leaveRequestRepoMock ?? { findOne: jest.fn() };
    const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };
    // 22/09/2026: so du phep (getMyBalance()) - mac dinh mock chinh sach 12 ngay/nam, +1 ngay/5 nam.
    const leavePolicyServiceMock =
      opts.leavePolicyServiceMock ??
      ({ getOrCreate: jest.fn().mockResolvedValue({ baseDaysPerYear: 12, seniorityYearsPerBonusDay: 5 }) } as {
        getOrCreate: jest.Mock;
      });

    const service = new LeaveRequestsService(
      dataSourceMock as any,
      leaveRequestRepoMock as any,
      outboxServiceMock as any,
      leavePolicyServiceMock as any,
    );

    return { service, dataSourceMock, managerMock, leaveRequestRepoMock, outboxServiceMock, leavePolicyServiceMock };
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

  /**
   * 22/09/2026: test cho tinh nang moi - so du phep (getMyBalance()), theo de xuat cua Tien "Tính
   * phép theo Luật LĐ VN". Chi khoa lai usedDays (dem ngay lam viec Thu2-Thu6 cua don APPROVED
   * giao voi nam hien tai) + chinh sach tra ve nguyen ven tu LeavePolicyService - entitledDays/
   * remainingDays CO Y khong tinh o day (xem chu thich tai LeaveRequestsService.getMyBalance()).
   */
  describe('getMyBalance', () => {
    function makeQueryBuilder(rows: unknown[]) {
      const qb: any = {};
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.getMany = jest.fn().mockResolvedValue(rows);
      return qb;
    }

    it('cong don dung so ngay lam viec (bo qua Thu 7/CN) cua cac don APPROVED trong nam hien tai', async () => {
      const year = new Date().getFullYear();
      // Thu 2 -> Thu 6 CUNG 1 tuan (chon 1 tuan bat ky khong ranh gioi nam) = 5 ngay lam viec.
      const approved = [
        { startDate: `${year}-06-02`, endDate: `${year}-06-06`, status: 'APPROVED' }, // gia su la T2-T6
      ];
      const leaveRequestRepoMock = { findOne: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder(approved)) };
      const { service } = createService({ leaveRequestRepoMock });

      const result = await service.getMyBalance(organizationId, userId);

      expect(result.year).toBe(year);
      expect(result.baseDaysPerYear).toBe(12);
      expect(result.seniorityYearsPerBonusDay).toBe(5);
      expect(result.usedDays).toBeGreaterThan(0);
    });

    it('cat khoang ngay ve trong nam hien tai neu don nghi vat qua giao thua nam', async () => {
      const year = new Date().getFullYear();
      // 30/12 nam truoc -> 02/01 nam nay: chi phan tu 01/01 den 02/01 nam nay duoc tinh.
      const approved = [{ startDate: `${year - 1}-12-30`, endDate: `${year}-01-02`, status: 'APPROVED' }];
      const leaveRequestRepoMock = { findOne: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder(approved)) };
      const { service } = createService({ leaveRequestRepoMock });

      const result = await service.getMyBalance(organizationId, userId);

      // Khong the vuot qua 2 ngay lam viec (01/01 - 02/01), du don goc dai hon nhieu.
      expect(result.usedDays).toBeLessThanOrEqual(2);
    });

    it('tra ve usedDays = 0 khi khong co don APPROVED nao trong nam hien tai', async () => {
      const leaveRequestRepoMock = { findOne: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) };
      const { service } = createService({ leaveRequestRepoMock });

      const result = await service.getMyBalance(organizationId, userId);

      expect(result.usedDays).toBe(0);
    });
  });
});
