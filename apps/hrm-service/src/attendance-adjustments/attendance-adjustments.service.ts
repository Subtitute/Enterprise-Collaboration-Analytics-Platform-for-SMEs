import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  AttendanceAdjustmentApprovedPayload,
  AttendanceAdjustmentRejectedPayload,
  ERROR_CODES,
  EVENT_TYPES,
  PaginatedResponse,
  paginate,
} from '@app/common-dto';
import { AttendanceAdjustment, AttendanceAdjustmentStatus } from '../entities/attendance-adjustment.entity';
import { Attendance } from '../entities/attendance.entity';
import { OutboxService } from '../outbox/outbox.service';
import { CreateAttendanceAdjustmentDto } from './dto/create-attendance-adjustment.dto';
import { DecideAttendanceAdjustmentDto } from './dto/decide-attendance-adjustment.dto';
import { AttendanceAdjustmentQueryDto } from './dto/attendance-adjustment-query.dto';

const PRODUCER = 'hrm-service';
/** So ngay toi da cho phep giai trinh nguoc ve truoc, tinh tu workDate - mirror gioi han client cu (AttendanceAdjustmentModal.tsx). */
const MAX_ADJUSTMENT_AGE_DAYS = 7;

/**
 * 22/09/2026: Giai trinh/duyet cham cong - thay the co che gia lap hoan toan bang localStorage o
 * frontend truoc day (khong luu server-side, khong dong bo giua trinh duyet/thiet bi, khong co
 * audit that). Mirror dung pattern LeaveRequestsService (leave-requests.service.ts): pre-check
 * khong khoa de fail-fast + khoa pessimistic_write + re-check ben trong transaction cho decide().
 */
@Injectable()
export class AttendanceAdjustmentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(AttendanceAdjustment) private readonly adjustmentRepo: Repository<AttendanceAdjustment>,
    @InjectRepository(Attendance) private readonly attendanceRepo: Repository<Attendance>,
    private readonly outboxService: OutboxService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateAttendanceAdjustmentDto,
  ): Promise<AttendanceAdjustment> {
    // Xac minh ban ghi cham cong thuoc DUNG nguoi goi va DUNG to chuc - khong cho giai trinh ho
    // ban ghi cua nguoi khac chi bang cach doan UUID.
    const attendance = await this.attendanceRepo.findOne({ where: { id: dto.attendanceId, organizationId, userId } });
    if (!attendance) {
      throw new NotFoundException({ message: 'Không tìm thấy bản ghi chấm công', errorCode: ERROR_CODES.ATTENDANCE_NOT_FOUND });
    }

    const nowMs = Date.now();
    const diffDays = (nowMs - new Date(attendance.workDate).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_ADJUSTMENT_AGE_DAYS) {
      throw new BadRequestException({
        message: 'Chỉ được giải trình cho các ngày trong vòng 7 ngày gần đây',
        errorCode: ERROR_CODES.ATTENDANCE_ADJUSTMENT_TOO_OLD,
      });
    }

    const proposedIn = new Date(dto.proposedCheckInAt);
    const proposedOut = new Date(dto.proposedCheckOutAt);
    if (proposedOut.getTime() <= proposedIn.getTime()) {
      throw new BadRequestException({
        message: 'Giờ ra đề xuất phải sau giờ vào đề xuất',
        errorCode: ERROR_CODES.ATTENDANCE_ADJUSTMENT_INVALID_RANGE,
      });
    }
    if (proposedOut.getTime() > nowMs) {
      throw new BadRequestException({
        message: 'Giờ ra đề xuất không được ở trong tương lai',
        errorCode: ERROR_CODES.ATTENDANCE_ADJUSTMENT_INVALID_RANGE,
      });
    }

    return this.adjustmentRepo.save(
      this.adjustmentRepo.create({
        organizationId,
        attendanceId: attendance.id,
        userId,
        workDate: attendance.workDate,
        originalCheckInAt: attendance.checkInAt,
        originalCheckOutAt: attendance.checkOutAt ?? null,
        proposedCheckInAt: proposedIn,
        proposedCheckOutAt: proposedOut,
        reason: dto.reason,
        status: AttendanceAdjustmentStatus.PENDING,
      }),
    );
  }

  async findMine(
    organizationId: string,
    userId: string,
    query: AttendanceAdjustmentQueryDto,
  ): Promise<PaginatedResponse<AttendanceAdjustment>> {
    const [data, total] = await this.adjustmentRepo.findAndCount({
      where: { organizationId, userId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  /** Danh sach giai trinh cham cong TOAN TO CHUC (Manager/Org Admin, PERMISSIONS.ATTENDANCE_ADJUSTMENT_VIEW). */
  async findAll(organizationId: string, query: AttendanceAdjustmentQueryDto): Promise<PaginatedResponse<AttendanceAdjustment>> {
    const where: { organizationId: string; userId?: string; status?: AttendanceAdjustmentStatus } = { organizationId };
    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;

    const [data, total] = await this.adjustmentRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  async approve(
    organizationId: string,
    id: string,
    approverId: string,
    dto: DecideAttendanceAdjustmentDto,
  ): Promise<AttendanceAdjustment> {
    return this.decide(
      organizationId,
      id,
      approverId,
      AttendanceAdjustmentStatus.APPROVED,
      dto,
      EVENT_TYPES.ATTENDANCE_ADJUSTMENT_APPROVED,
    );
  }

  async reject(
    organizationId: string,
    id: string,
    approverId: string,
    dto: DecideAttendanceAdjustmentDto,
  ): Promise<AttendanceAdjustment> {
    return this.decide(
      organizationId,
      id,
      approverId,
      AttendanceAdjustmentStatus.REJECTED,
      dto,
      EVENT_TYPES.ATTENDANCE_ADJUSTMENT_REJECTED,
    );
  }

  /**
   * Duyet/tu choi 1 yeu cau giai trinh - mirror pattern khoa pessimistic_write + re-check cua
   * LeaveRequestsService.decide(). Diem khac biet chinh: khi DUYET, cap nhat LUON gio check-in/out
   * that su tren Attendance trong CUNG transaction - day chinh la "hau qua that" cua tinh nang nay
   * (khac LeaveRequestsService, khong co ban ghi goc nao khac can dong bo).
   */
  private async decide(
    organizationId: string,
    id: string,
    approverId: string,
    toStatus: AttendanceAdjustmentStatus.APPROVED | AttendanceAdjustmentStatus.REJECTED,
    dto: DecideAttendanceAdjustmentDto,
    eventType: typeof EVENT_TYPES.ATTENDANCE_ADJUSTMENT_APPROVED | typeof EVENT_TYPES.ATTENDANCE_ADJUSTMENT_REJECTED,
  ): Promise<AttendanceAdjustment> {
    const existing = await this.adjustmentRepo.findOne({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException({ message: 'Không tìm thấy yêu cầu giải trình chấm công', errorCode: ERROR_CODES.ATTENDANCE_ADJUSTMENT_NOT_FOUND });
    }
    if (existing.status !== AttendanceAdjustmentStatus.PENDING) {
      throw new BadRequestException({
        message: 'Yêu cầu giải trình này đã được xử lý trước đó',
        errorCode: ERROR_CODES.ATTENDANCE_ADJUSTMENT_ALREADY_DECIDED,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const adjustment = await manager.findOne(AttendanceAdjustment, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!adjustment) {
        throw new NotFoundException({ message: 'Không tìm thấy yêu cầu giải trình chấm công', errorCode: ERROR_CODES.ATTENDANCE_ADJUSTMENT_NOT_FOUND });
      }
      if (adjustment.status !== AttendanceAdjustmentStatus.PENDING) {
        throw new BadRequestException({
          message: 'Yêu cầu giải trình này đã được xử lý trước đó',
          errorCode: ERROR_CODES.ATTENDANCE_ADJUSTMENT_ALREADY_DECIDED,
        });
      }

      adjustment.status = toStatus;
      adjustment.approverId = approverId;
      adjustment.decisionNote = dto.decisionNote ?? null;
      adjustment.decidedAt = new Date();
      const updated = await manager.save(adjustment);

      if (toStatus === AttendanceAdjustmentStatus.APPROVED) {
        await manager.update(
          Attendance,
          { id: updated.attendanceId, organizationId },
          { checkInAt: updated.proposedCheckInAt, checkOutAt: updated.proposedCheckOutAt },
        );
      }

      const payload: AttendanceAdjustmentApprovedPayload | AttendanceAdjustmentRejectedPayload = {
        attendanceAdjustmentId: updated.id,
        userId: updated.userId,
        actorId: approverId,
      };
      await this.outboxService.record(manager, {
        eventType,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return updated;
    });
  }
}
