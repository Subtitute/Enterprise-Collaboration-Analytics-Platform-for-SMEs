import { AttendanceAdjustmentStatus } from '../entities/attendance-adjustment.entity';
import { Attendance } from '../entities/attendance.entity';
import { ERROR_CODES, EVENT_TYPES } from '@app/common-dto';
import { AttendanceAdjustmentsService } from './attendance-adjustments.service';
import { CreateAttendanceAdjustmentDto } from './dto/create-attendance-adjustment.dto';
import { DecideAttendanceAdjustmentDto } from './dto/decide-attendance-adjustment.dto';

/**
 * 22/09/2026: Unit test cho AttendanceAdjustmentsService - mirror phong cach mock thu cong
 * (DataSource/Repository/OutboxService, khong boot NestJS module hay DB that) va pattern
 * khoa pessimistic_write + re-check cua LeaveRequestsService.decide() (xem
 * leave-requests.service.spec.ts, apps/hrm-service/src/leave-requests).
 */
describe('AttendanceAdjustmentsService', () => {
  const organizationId = 'org-1';
  const userId = 'user-1';
  const attendanceId = 'att-1';
  const adjustmentId = 'adj-1';
  const approverId = 'approver-1';

  function todayIso(hour: number): string {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  }
  function todayDateStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function pendingAdjustment(overrides: Record<string, unknown> = {}) {
    return {
      id: adjustmentId,
      organizationId,
      attendanceId,
      userId,
      workDate: todayDateStr(),
      originalCheckInAt: new Date(todayIso(8)),
      originalCheckOutAt: new Date(todayIso(17)),
      proposedCheckInAt: new Date(todayIso(8)),
      proposedCheckOutAt: new Date(todayIso(18)),
      reason: 'Quen check-out',
      status: AttendanceAdjustmentStatus.PENDING,
      approverId: null,
      decisionNote: null,
      decidedAt: null,
      ...overrides,
    };
  }

  function createService(opts: {
    adjustmentRepoMock?: { findOne: jest.Mock };
    attendanceRepoMock?: { findOne: jest.Mock };
    managerMock?: { findOne?: jest.Mock; save: jest.Mock; update?: jest.Mock };
  } = {}) {
    const managerMock =
      opts.managerMock ??
      ({
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
        update: jest.fn().mockResolvedValue(undefined),
      } as { save: jest.Mock; update: jest.Mock });
    const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
    const adjustmentRepoMock = opts.adjustmentRepoMock ?? {
      findOne: jest.fn(),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve({ id: adjustmentId, ...(entity as object) })),
    };
    const attendanceRepoMock = opts.attendanceRepoMock ?? { findOne: jest.fn() };
    const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

    const service = new AttendanceAdjustmentsService(
      dataSourceMock as any,
      adjustmentRepoMock as any,
      attendanceRepoMock as any,
      outboxServiceMock as any,
    );

    return { service, dataSourceMock, managerMock, adjustmentRepoMock, attendanceRepoMock, outboxServiceMock };
  }

  describe('create', () => {
    it('tao yeu cau giai trinh thanh cong voi trang thai PENDING, chup lai gio goc tu Attendance', async () => {
      const attendance = {
        id: attendanceId,
        organizationId,
        userId,
        workDate: todayDateStr(),
        checkInAt: new Date(todayIso(8)),
        checkOutAt: null,
      };
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(attendance) };
      const { service } = createService({ attendanceRepoMock });
      // 22/09/2026: dung moc gio TUONG DOI voi Date.now() (vd "2 gio truoc"/"1 gio truoc") thay vi
      // gio co dinh trong ngay ("08:00"/"17:00") - gio co dinh co the ROI VAO TUONG LAI tuy thoi
      // diem chay test (vd chay luc 06:00 sang thi "17:00 hom nay" la tuong lai), khien
      // service.create() tu choi voi ATTENDANCE_ADJUSTMENT_INVALID_RANGE mot cach gia (flaky test).
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const dto: CreateAttendanceAdjustmentDto = {
        attendanceId,
        proposedCheckInAt: twoHoursAgo,
        proposedCheckOutAt: oneHourAgo,
        reason: 'Quen check-out',
      };

      const result = await service.create(organizationId, userId, dto);

      expect(result.status).toBe(AttendanceAdjustmentStatus.PENDING);
      expect((result as any).originalCheckOutAt).toBeNull();
    });

    it('bao NotFoundException neu attendanceId khong thuoc nguoi goi/to chuc', async () => {
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service } = createService({ attendanceRepoMock });
      const dto: CreateAttendanceAdjustmentDto = {
        attendanceId,
        proposedCheckInAt: todayIso(8),
        proposedCheckOutAt: todayIso(17),
        reason: 'x',
      };

      await expect(service.create(organizationId, userId, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.ATTENDANCE_NOT_FOUND }),
      });
    });

    it('tu choi neu gio ra de xuat khong sau gio vao de xuat', async () => {
      const attendance = { id: attendanceId, organizationId, userId, workDate: todayDateStr(), checkInAt: new Date(), checkOutAt: null };
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(attendance) };
      const { service } = createService({ attendanceRepoMock });
      const dto: CreateAttendanceAdjustmentDto = {
        attendanceId,
        proposedCheckInAt: todayIso(17),
        proposedCheckOutAt: todayIso(8),
        reason: 'x',
      };

      await expect(service.create(organizationId, userId, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.ATTENDANCE_ADJUSTMENT_INVALID_RANGE }),
      });
    });

    it('tu choi neu ngay lam viec da qua 7 ngay (gioi han giai trinh nguoc)', async () => {
      const old = new Date();
      old.setDate(old.getDate() - 10);
      const oldDateStr = old.toISOString().slice(0, 10);
      const attendance = { id: attendanceId, organizationId, userId, workDate: oldDateStr, checkInAt: old, checkOutAt: null };
      const attendanceRepoMock = { findOne: jest.fn().mockResolvedValue(attendance) };
      const { service } = createService({ attendanceRepoMock });
      const dto: CreateAttendanceAdjustmentDto = {
        attendanceId,
        proposedCheckInAt: old.toISOString(),
        proposedCheckOutAt: old.toISOString(),
        reason: 'x',
      };

      await expect(service.create(organizationId, userId, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.ATTENDANCE_ADJUSTMENT_TOO_OLD }),
      });
    });
  });

  describe('approve/reject - khoa pessimistic_write + re-check, DUYET phai cap nhat Attendance that', () => {
    it('approve thanh cong: cap nhat status/approverId, GHI DE checkInAt/checkOutAt that su cua Attendance, ghi outbox ATTENDANCE_ADJUSTMENT_APPROVED', async () => {
      const preCheck = pendingAdjustment();
      const locked = pendingAdjustment();
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(locked),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
        update: jest.fn().mockResolvedValue(undefined),
      };
      const adjustmentRepoMock = { findOne: jest.fn().mockResolvedValue(preCheck) };
      const { service, outboxServiceMock } = createService({ adjustmentRepoMock, managerMock });
      const dto: DecideAttendanceAdjustmentDto = { decisionNote: 'Da xac nhan' };

      const result = await service.approve(organizationId, adjustmentId, approverId, dto);

      expect(result.status).toBe(AttendanceAdjustmentStatus.APPROVED);
      expect(managerMock.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(managerMock.update).toHaveBeenCalledWith(
        Attendance,
        { id: attendanceId, organizationId },
        { checkInAt: locked.proposedCheckInAt, checkOutAt: locked.proposedCheckOutAt },
      );
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EVENT_TYPES.ATTENDANCE_ADJUSTMENT_APPROVED,
          payload: expect.objectContaining({ attendanceAdjustmentId: adjustmentId, userId, actorId: approverId }),
        }),
      );
    });

    it('reject thanh cong: KHONG dong cham gi den Attendance, ghi outbox ATTENDANCE_ADJUSTMENT_REJECTED', async () => {
      const preCheck = pendingAdjustment();
      const locked = pendingAdjustment();
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(locked),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
        update: jest.fn().mockResolvedValue(undefined),
      };
      const adjustmentRepoMock = { findOne: jest.fn().mockResolvedValue(preCheck) };
      const { service, outboxServiceMock } = createService({ adjustmentRepoMock, managerMock });

      const result = await service.reject(organizationId, adjustmentId, approverId, {});

      expect(result.status).toBe(AttendanceAdjustmentStatus.REJECTED);
      expect(managerMock.update).not.toHaveBeenCalled();
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: EVENT_TYPES.ATTENDANCE_ADJUSTMENT_REJECTED }),
      );
    });

    it('tu choi ngay tu pre-check neu yeu cau da duoc xu ly truoc do', async () => {
      const alreadyDecided = pendingAdjustment({ status: AttendanceAdjustmentStatus.APPROVED });
      const adjustmentRepoMock = { findOne: jest.fn().mockResolvedValue(alreadyDecided) };
      const { service, dataSourceMock } = createService({ adjustmentRepoMock });

      await expect(service.reject(organizationId, adjustmentId, approverId, {})).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.ATTENDANCE_ADJUSTMENT_ALREADY_DECIDED }),
      });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    it('tu choi neu row vua khoa BEN TRONG transaction da bi Manager khac quyet dinh truoc (stale pre-check)', async () => {
      const preCheck = pendingAdjustment();
      const lockedAfterRace = pendingAdjustment({ status: AttendanceAdjustmentStatus.REJECTED, approverId: 'other-manager' });
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(lockedAfterRace),
        save: jest.fn(),
        update: jest.fn(),
      };
      const adjustmentRepoMock = { findOne: jest.fn().mockResolvedValue(preCheck) };
      const { service } = createService({ adjustmentRepoMock, managerMock });

      await expect(service.approve(organizationId, adjustmentId, approverId, {})).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.ATTENDANCE_ADJUSTMENT_ALREADY_DECIDED }),
      });
      expect(managerMock.save).not.toHaveBeenCalled();
      expect(managerMock.update).not.toHaveBeenCalled();
    });
  });
});
