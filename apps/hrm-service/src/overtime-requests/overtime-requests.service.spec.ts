import { ERROR_CODES, EVENT_TYPES } from '@app/common-dto';
import { OvertimeMultiplierType, OvertimeRequestStatus } from '../entities/overtime-request.entity';
import { OvertimeRequestsService } from './overtime-requests.service';
import { CreateOvertimeRequestDto } from './dto/create-overtime-request.dto';

/**
 * 22/09/2026: Unit test cho OvertimeRequestsService - mirror phong cach mock thu cong cua
 * leave-requests.service.spec.ts/attendance-adjustments.service.spec.ts (khong boot NestJS module
 * hay DB that).
 */
describe('OvertimeRequestsService', () => {
  const organizationId = 'org-1';
  const userId = 'user-1';
  const overtimeId = 'ot-1';
  const approverId = 'approver-1';
  const workDate = '2026-09-22';

  function pendingOvertime(overrides: Record<string, unknown> = {}) {
    return {
      id: overtimeId,
      organizationId,
      userId,
      workDate,
      otStart: '18:00',
      otEnd: '20:00',
      multiplierType: OvertimeMultiplierType.WEEKDAY,
      multiplier: 1.5,
      estimatedHours: 2,
      reason: 'Chay deadline',
      status: OvertimeRequestStatus.PENDING,
      approverId: null,
      decisionNote: null,
      decidedAt: null,
      ...overrides,
    };
  }

  function createService(opts: {
    overtimeRepoMock?: { findOne: jest.Mock; find?: jest.Mock; create?: jest.Mock; save?: jest.Mock };
    managerMock?: { findOne?: jest.Mock; save: jest.Mock };
  } = {}) {
    const managerMock =
      opts.managerMock ??
      ({ save: jest.fn((entity: unknown) => Promise.resolve(entity)) } as { save: jest.Mock });
    const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
    const overtimeRepoMock = opts.overtimeRepoMock ?? {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve({ id: overtimeId, ...(entity as object) })),
    };
    const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

    const service = new OvertimeRequestsService(dataSourceMock as any, overtimeRepoMock as any, outboxServiceMock as any);

    return { service, dataSourceMock, managerMock, overtimeRepoMock, outboxServiceMock };
  }

  describe('create', () => {
    it('tao yeu cau OT thanh cong, SERVER TU TINH multiplier tu multiplierType (khong nhan tu client)', async () => {
      const { service } = createService();
      const dto: CreateOvertimeRequestDto = {
        workDate,
        otStart: '18:00',
        otEnd: '20:30',
        multiplierType: OvertimeMultiplierType.HOLIDAY,
        reason: 'Ho tro trien khai',
      };

      const result = await service.create(organizationId, userId, dto);

      expect(result.status).toBe(OvertimeRequestStatus.PENDING);
      expect((result as any).multiplier).toBe(3.0);
      expect((result as any).estimatedHours).toBe(2.5);
    });

    it('tu choi neu gio ket thuc khong sau gio bat dau', async () => {
      const { service } = createService();
      const dto: CreateOvertimeRequestDto = {
        workDate,
        otStart: '20:00',
        otEnd: '18:00',
        multiplierType: OvertimeMultiplierType.WEEKDAY,
        reason: 'x',
      };

      await expect(service.create(organizationId, userId, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.OVERTIME_REQUEST_INVALID_RANGE }),
      });
    });

    it('tu choi neu vuot tran 40h OT/thang (cong don cac yeu cau CHUA bi tu choi trong thang)', async () => {
      const overtimeRepoMock = {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([
          pendingOvertime({ id: 'ot-existing-1', estimatedHours: 38, status: OvertimeRequestStatus.APPROVED }),
          pendingOvertime({ id: 'ot-existing-2', estimatedHours: 100, status: OvertimeRequestStatus.REJECTED }), // bi loai vi REJECTED
        ]),
        create: jest.fn((data: unknown) => data),
        save: jest.fn(),
      };
      const { service } = createService({ overtimeRepoMock });
      const dto: CreateOvertimeRequestDto = {
        workDate,
        otStart: '18:00',
        otEnd: '21:00', // 3h -> 38 + 3 = 41 > 40
        multiplierType: OvertimeMultiplierType.WEEKDAY,
        reason: 'x',
      };

      await expect(service.create(organizationId, userId, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.OVERTIME_MONTHLY_CAP_EXCEEDED }),
      });
      expect(overtimeRepoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('approve/reject - khoa pessimistic_write + re-check', () => {
    it('approve thanh cong: cap nhat status/approverId, ghi outbox OVERTIME_REQUEST_APPROVED', async () => {
      const preCheck = pendingOvertime();
      const locked = pendingOvertime();
      const managerMock = { findOne: jest.fn().mockResolvedValue(locked), save: jest.fn((e: unknown) => Promise.resolve(e)) };
      const overtimeRepoMock = { findOne: jest.fn().mockResolvedValue(preCheck) };
      const { service, outboxServiceMock } = createService({ overtimeRepoMock, managerMock });

      const result = await service.approve(organizationId, overtimeId, approverId, { decisionNote: 'OK' });

      expect(result.status).toBe(OvertimeRequestStatus.APPROVED);
      expect(managerMock.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EVENT_TYPES.OVERTIME_REQUEST_APPROVED,
          payload: expect.objectContaining({ overtimeRequestId: overtimeId, userId, actorId: approverId }),
        }),
      );
    });

    it('tu choi ngay tu pre-check neu yeu cau da duoc xu ly truoc do', async () => {
      const alreadyDecided = pendingOvertime({ status: OvertimeRequestStatus.REJECTED });
      const overtimeRepoMock = { findOne: jest.fn().mockResolvedValue(alreadyDecided) };
      const { service, dataSourceMock } = createService({ overtimeRepoMock });

      await expect(service.approve(organizationId, overtimeId, approverId, {})).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.OVERTIME_REQUEST_ALREADY_DECIDED }),
      });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    it('tu choi neu row vua khoa BEN TRONG transaction da bi Manager khac quyet dinh truoc (stale pre-check)', async () => {
      const preCheck = pendingOvertime();
      const lockedAfterRace = pendingOvertime({ status: OvertimeRequestStatus.APPROVED, approverId: 'other-manager' });
      const managerMock = { findOne: jest.fn().mockResolvedValue(lockedAfterRace), save: jest.fn() };
      const overtimeRepoMock = { findOne: jest.fn().mockResolvedValue(preCheck) };
      const { service } = createService({ overtimeRepoMock, managerMock });

      await expect(service.reject(organizationId, overtimeId, approverId, {})).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.OVERTIME_REQUEST_ALREADY_DECIDED }),
      });
      expect(managerMock.save).not.toHaveBeenCalled();
    });
  });
});
