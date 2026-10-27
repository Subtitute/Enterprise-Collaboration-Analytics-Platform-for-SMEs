import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, FindOptionsWhere, Repository } from 'typeorm';
import {
  ERROR_CODES,
  EVENT_TYPES,
  OvertimeRequestApprovedPayload,
  OvertimeRequestRejectedPayload,
  PaginatedResponse,
  PERMISSIONS,
  paginate,
} from '@app/common-dto';
// 26/10/2026: pham vi xem/duyet theo phong ban cua Manager - xem src/user-directory.
import { ScopeCaller, assertCanDecide, scopeUserFilter } from '../user-directory/user-directory';
import { OvertimeMultiplierType, OvertimeRequest, OvertimeRequestStatus } from '../entities/overtime-request.entity';
import { OutboxService } from '../outbox/outbox.service';
import { CreateOvertimeRequestDto } from './dto/create-overtime-request.dto';
import { DecideOvertimeRequestDto } from './dto/decide-overtime-request.dto';
import { OvertimeRequestQueryDto } from './dto/overtime-request-query.dto';

const PRODUCER = 'hrm-service';
/** Tran toi da gio OT/thang/nguoi - mirror gioi han client cu (OvertimeRegistrationModal.tsx). */
const MONTHLY_CAP_HOURS = 40;

/** He so tang ca theo Luat LD VN, SERVER TU TINH tu multiplierType - khong nhan tu client (tranh gui sai he so lam sai gio tinh luong). */
function computeMultiplier(type: OvertimeMultiplierType): number {
  switch (type) {
    case OvertimeMultiplierType.HOLIDAY:
      return 3.0;
    case OvertimeMultiplierType.WEEKEND:
      return 2.0;
    default:
      return 1.5;
  }
}

function computeEstimatedHours(otStart: string, otEnd: string): number {
  const [startHour, startMinute] = otStart.split(':').map(Number);
  const [endHour, endMinute] = otEnd.split(':').map(Number);
  const diffMinutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return diffMinutes > 0 ? Math.round((diffMinutes / 60) * 10) / 10 : 0;
}

/**
 * 22/09/2026 (fix loi thuc te, phat hien qua smoke test sau khi rebuild Docker): `workDate` la cot
 * Postgres kieu `date` (xem overtime-request.entity.ts) - dung TypeORM `Like('YYYY-MM%')` tren cot
 * nay nem QueryFailedError "operator does not exist: date ~~ unknown" (Postgres khong cho phep
 * LIKE truc tiep tren kieu date, chi tren text/varchar). Chuyen sang so sanh khoang ngay
 * (Between(dauThang, cuoiThang)) - dung cach LeaveRequestsService.getMyBalance() da lam dung tu
 * dau (so sanh chuoi 'YYYY-MM-DD' bang <=/>=, khong dung LIKE).
 */
function monthDateRange(monthPrefix: string): [string, string] {
  const [year, month] = monthPrefix.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return [`${monthPrefix}-01`, `${monthPrefix}-${String(lastDay).padStart(2, '0')}`];
}

/**
 * 22/09/2026: Dang ky/duyet tang ca (OT) - thay the co che gia lap hoan toan bang localStorage o
 * frontend truoc day. Mirror dung pattern LeaveRequestsService.decide() cho approve()/reject().
 */
@Injectable()
export class OvertimeRequestsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(OvertimeRequest) private readonly overtimeRepo: Repository<OvertimeRequest>,
    private readonly outboxService: OutboxService,
  ) {}

  async create(organizationId: string, userId: string, dto: CreateOvertimeRequestDto): Promise<OvertimeRequest> {
    const estimatedHours = computeEstimatedHours(dto.otStart, dto.otEnd);
    if (estimatedHours <= 0) {
      throw new BadRequestException({
        message: 'Giờ kết thúc OT phải sau giờ bắt đầu',
        errorCode: ERROR_CODES.OVERTIME_REQUEST_INVALID_RANGE,
      });
    }

    // Tran 40h/thang: cong don gio cua cac yeu cau CHUA bi tu choi trong CUNG thang cua nguoi nay.
    const [monthStart, monthEnd] = monthDateRange(dto.workDate.slice(0, 7));
    const existingThisMonth = await this.overtimeRepo.find({
      where: { organizationId, userId, workDate: Between(monthStart, monthEnd) },
    });
    const usedHours = existingThisMonth
      .filter((ot) => ot.status !== OvertimeRequestStatus.REJECTED)
      .reduce((sum, ot) => sum + ot.estimatedHours, 0);
    if (usedHours + estimatedHours > MONTHLY_CAP_HOURS) {
      throw new BadRequestException({
        message: `Tổng giờ OT trong tháng không được vượt quá ${MONTHLY_CAP_HOURS} giờ`,
        errorCode: ERROR_CODES.OVERTIME_MONTHLY_CAP_EXCEEDED,
      });
    }

    return this.overtimeRepo.save(
      this.overtimeRepo.create({
        organizationId,
        userId,
        workDate: dto.workDate,
        otStart: dto.otStart,
        otEnd: dto.otEnd,
        multiplierType: dto.multiplierType,
        multiplier: computeMultiplier(dto.multiplierType),
        estimatedHours,
        reason: dto.reason,
        status: OvertimeRequestStatus.PENDING,
      }),
    );
  }

  async findMine(organizationId: string, userId: string, query: OvertimeRequestQueryDto): Promise<PaginatedResponse<OvertimeRequest>> {
    const where: FindOptionsWhere<OvertimeRequest> = { organizationId, userId };
    if (query.status) where.status = query.status;
    if (query.month) where.workDate = Between(...monthDateRange(query.month));

    const [data, total] = await this.overtimeRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  /** Danh sach dang ky tang ca TOAN TO CHUC (Manager/Org Admin, PERMISSIONS.OVERTIME_REQUEST_VIEW). */
  // 26/10/2026: `caller` (tuy chon) - Manager chi xem cua chinh minh + thanh vien phong ban (xem scopeUserFilter()).
  async findAll(organizationId: string, query: OvertimeRequestQueryDto, caller?: ScopeCaller): Promise<PaginatedResponse<OvertimeRequest>> {
    const where: FindOptionsWhere<OvertimeRequest> = { organizationId };
    const userFilter = await scopeUserFilter(this.dataSource, organizationId, caller, PERMISSIONS.OVERTIME_REQUEST_VIEW, query.userId);
    if (userFilter === false) return paginate([], 0, query.page, query.limit);
    if (userFilter) where.userId = userFilter;
    if (query.status) where.status = query.status;
    if (query.month) where.workDate = Between(...monthDateRange(query.month));

    const [data, total] = await this.overtimeRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  // 26/10/2026: `caller` (tuy chon) - Manager chi duyet don cua thanh vien phong ban, khong tu duyet (xem assertCanDecide()).
  async approve(organizationId: string, id: string, approverId: string, dto: DecideOvertimeRequestDto, caller?: ScopeCaller): Promise<OvertimeRequest> {
    return this.decide(organizationId, id, approverId, OvertimeRequestStatus.APPROVED, dto, EVENT_TYPES.OVERTIME_REQUEST_APPROVED, caller);
  }

  async reject(organizationId: string, id: string, approverId: string, dto: DecideOvertimeRequestDto, caller?: ScopeCaller): Promise<OvertimeRequest> {
    return this.decide(organizationId, id, approverId, OvertimeRequestStatus.REJECTED, dto, EVENT_TYPES.OVERTIME_REQUEST_REJECTED, caller);
  }

  /** Duyet/tu choi 1 yeu cau OT - mirror pattern khoa pessimistic_write + re-check cua LeaveRequestsService.decide(). */
  private async decide(
    organizationId: string,
    id: string,
    approverId: string,
    toStatus: OvertimeRequestStatus.APPROVED | OvertimeRequestStatus.REJECTED,
    dto: DecideOvertimeRequestDto,
    eventType: typeof EVENT_TYPES.OVERTIME_REQUEST_APPROVED | typeof EVENT_TYPES.OVERTIME_REQUEST_REJECTED,
    caller?: ScopeCaller,
  ): Promise<OvertimeRequest> {
    const existing = await this.overtimeRepo.findOne({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException({ message: 'Không tìm thấy yêu cầu tăng ca', errorCode: ERROR_CODES.OVERTIME_REQUEST_NOT_FOUND });
    }
    // 26/10/2026: chan Manager duyet don ngoai phong ban/don cua chinh minh.
    await assertCanDecide(this.dataSource, organizationId, caller, PERMISSIONS.OVERTIME_REQUEST_APPROVE, existing.userId);
    if (existing.status !== OvertimeRequestStatus.PENDING) {
      throw new BadRequestException({
        message: 'Yêu cầu tăng ca này đã được xử lý trước đó',
        errorCode: ERROR_CODES.OVERTIME_REQUEST_ALREADY_DECIDED,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const overtime = await manager.findOne(OvertimeRequest, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!overtime) {
        throw new NotFoundException({ message: 'Không tìm thấy yêu cầu tăng ca', errorCode: ERROR_CODES.OVERTIME_REQUEST_NOT_FOUND });
      }
      if (overtime.status !== OvertimeRequestStatus.PENDING) {
        throw new BadRequestException({
          message: 'Yêu cầu tăng ca này đã được xử lý trước đó',
          errorCode: ERROR_CODES.OVERTIME_REQUEST_ALREADY_DECIDED,
        });
      }

      overtime.status = toStatus;
      overtime.approverId = approverId;
      overtime.decisionNote = dto.decisionNote ?? null;
      overtime.decidedAt = new Date();
      const updated = await manager.save(overtime);

      const payload: OvertimeRequestApprovedPayload | OvertimeRequestRejectedPayload = {
        overtimeRequestId: updated.id,
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
