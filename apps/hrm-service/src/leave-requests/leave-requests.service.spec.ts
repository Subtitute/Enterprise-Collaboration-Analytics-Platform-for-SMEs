import { ERROR_CODES, EVENT_TYPES, LeaveRequestStatus } from '@app/common-dto';
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
    leaveRequestRepoMock?: { findOne: jest.Mock };
    managerMock?: { findOne?: jest.Mock; create?: jest.Mock; save: jest.Mock };
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

    const service = new LeaveRequestsService(
      dataSourceMock as any,
      leaveRequestRepoMock as any,
      outboxServiceMock as any,
    );

    return { service, dataSourceMock, managerMock, leaveRequestRepoMock, outboxServiceMock };
  }

  describe('create', () => {
    it('tao yeu cau nghi phep moi thanh cong voi trang thai PENDING, ghi outbox event LEAVE_REQUEST_CREATED', async () => {
      const { service, outboxServiceMock } = createService();
      const dto: CreateLeaveRequestDto = {
        startDate: '2026-09-01',
        endDate: '2026-09-03',
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

    it('tu choi khi ngay bat dau sau ngay ket thuc, khong mo transaction', async () => {
      const { service, dataSourceMock } = createService();
      const dto: CreateLeaveRequestDto = { startDate: '2026-09-05', endDate: '2026-09-01', reason: 'x' };

      await expect(service.create(organizationId, userId, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.LEAVE_DATE_RANGE_INVALID }),
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
});
