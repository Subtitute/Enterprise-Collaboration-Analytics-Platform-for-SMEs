import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOperator, Repository } from 'typeorm';
import {
  ERROR_CODES,
  EVENT_TYPES,
  LeaveRequestApprovedPayload,
  LeaveRequestCreatedPayload,
  LeaveRequestRejectedPayload,
  LeaveRequestStatus,
  PaginatedResponse,
  PERMISSIONS,
  paginate,
} from '@app/common-dto';
// 26/10/2026: pham vi xem/duyet theo phong ban cua Manager - xem src/user-directory.
import { ScopeCaller, assertCanDecide, scopeUserFilter } from '../user-directory/user-directory';
import { LeaveRequest } from '../entities/leave-request.entity';
import { OutboxService } from '../outbox/outbox.service';
import { toGmt7DateString } from '../attendance/attendance-date.util';
import { LeavePolicyService } from '../leave-policy/leave-policy.service';
import { countWorkingDaysInclusive } from './working-days.util';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto';
import { LeaveRequestQueryDto } from './dto/leave-request-query.dto';

const PRODUCER = 'hrm-service';

/** GET /leave-requests/me/balance - xem LeaveRequestsService.getMyBalance(). */
export interface LeaveBalance {
  year: number;
  usedDays: number;
  baseDaysPerYear: number;
  seniorityYearsPerBonusDay: number;
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(LeaveRequest) private readonly leaveRequestRepo: Repository<LeaveRequest>,
    private readonly outboxService: OutboxService,
    private readonly leavePolicyService: LeavePolicyService,
  ) {}

  async create(organizationId: string, userId: string, dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
    if (new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new BadRequestException({ message: 'Ngày bắt đầu không được sau ngày kết thúc', errorCode: ERROR_CODES.LEAVE_DATE_RANGE_INVALID });
    }
    // 15/09/2026 (sua loi thuc te - phan hoi cua GVHD): truoc ban sua nay KHONG co kiem tra nao ca -
    // co the tao yeu cau nghi phep cho 1 ngay DA QUA. So sanh dang chuoi 'YYYY-MM-DD' (ca dto.startDate
    // - da qua @IsDateString - lan toGmt7DateString deu cung dinh dang, zero-pad co dinh) thay vi
    // parse ve Date object de so sanh, tranh moi rui ro lech gio/timezone; dto.startDate co the mang
    // theo phan gio (ISO datetime) nen cat lay 10 ky tu dau truoc khi so sanh. Chan o day (server) la
    // lop xac thuc THAT SU - DatePicker.tsx/NewLeaveRequestModal.tsx (frontend) chi la lop chan dau
    // tien cho trai nghiem nguoi dung, khong the tin tuong don phuong.
    const todayGmt7 = toGmt7DateString(new Date());
    if (dto.startDate.slice(0, 10) < todayGmt7) {
      throw new BadRequestException({ message: 'Ngày bắt đầu không được ở trong quá khứ', errorCode: ERROR_CODES.LEAVE_START_DATE_IN_PAST });
    }

    return this.dataSource.transaction(async (manager) => {
      const leaveRequest = await manager.save(
        manager.create(LeaveRequest, {
          organizationId,
          userId,
          startDate: dto.startDate,
          endDate: dto.endDate,
          reason: dto.reason,
          status: LeaveRequestStatus.PENDING,
        }),
      );

      const payload: LeaveRequestCreatedPayload = {
        leaveRequestId: leaveRequest.id,
        userId,
        startDate: dto.startDate,
        endDate: dto.endDate,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.LEAVE_REQUEST_CREATED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return leaveRequest;
    });
  }

  async findMine(organizationId: string, userId: string, query: LeaveRequestQueryDto): Promise<PaginatedResponse<LeaveRequest>> {
    const [data, total] = await this.leaveRequestRepo.findAndCount({
      where: { organizationId, userId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  /**
   * Danh sach nghi phep TOAN TO CHUC (Manager/Org Admin, PERMISSIONS.LEAVE_REQUEST_VIEW) - loc
   * duoc theo userId/status. 03/10/2026: truyen userId ma KHONG truyen status = lich su nghi phep
   * DAY DU (moi trang thai) cua RIENG 1 nhan vien - xem chu thich tai LeaveRequestQueryDto.
   *
   * 26/10/2026: `caller` (tuy chon) - Manager chi xem don cua chinh minh + thanh vien phong ban
   * (read-model dim_user), khong con toan to chuc; Org Admin (USER_MANAGE) giu nguyen.
   */
  async findAll(organizationId: string, query: LeaveRequestQueryDto, caller?: ScopeCaller): Promise<PaginatedResponse<LeaveRequest>> {
    const where: { organizationId: string; userId?: string | FindOperator<string>; status?: LeaveRequestStatus } = { organizationId };
    const userFilter = await scopeUserFilter(this.dataSource, organizationId, caller, PERMISSIONS.LEAVE_REQUEST_VIEW, query.userId);
    if (userFilter === false) return paginate([], 0, query.page, query.limit);
    if (userFilter) where.userId = userFilter;
    if (query.status) where.status = query.status;

    const [data, total] = await this.leaveRequestRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  /**
   * 22/09/2026: So du phep nam hien tai (HRM-lite mo rong, theo de xuat cua Tien: "Số dư phép -
   * Theo dõi còn/đã dùng - Cập nhật realtime sau khi duyệt"). Chi tra ve `usedDays` (so ngay lam
   * viec cua CAC don APPROVED giao voi nam hien tai) + chinh sach hien hanh (baseDaysPerYear/
   * seniorityYearsPerBonusDay) - KHONG tu tinh entitledDays/remainingDays o day vi con thieu 1
   * thanh phan CHI frontend co san: ngay vao lam (User.createdAt, song o database rieng cua IAM
   * Service - HRM Service khong duoc phep truy van truc tiep, database-per-service). Frontend
   * (LeaveRequestsPage.tsx) da co san du lieu nay qua useOrgUsersQuery() (goi API that qua Gateway,
   * khong phai truy van DB xuyen service) nen ghep not phia frontend, mirror dung pattern
   * isNewMember/expectedDays cua MonthlyTimesheetTable.tsx cho cung 1 loai gioi han.
   */
  async getMyBalance(organizationId: string, userId: string): Promise<LeaveBalance> {
    const policy = await this.leavePolicyService.getOrCreate(organizationId);
    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const approvedThisYear = await this.leaveRequestRepo
      .createQueryBuilder('lr')
      .where('lr.organizationId = :organizationId', { organizationId })
      .andWhere('lr.userId = :userId', { userId })
      .andWhere('lr.status = :status', { status: LeaveRequestStatus.APPROVED })
      .andWhere('lr.startDate <= :yearEnd', { yearEnd })
      .andWhere('lr.endDate >= :yearStart', { yearStart })
      .getMany();

    let usedDays = 0;
    for (const lr of approvedThisYear) {
      // Cat khoang giao voi nam hien tai truoc khi dem ngay lam viec - phong truong hop don nghi
      // vat qua giao thua nam (hiem nhung van dung).
      const clampedStart = lr.startDate < yearStart ? yearStart : lr.startDate;
      const clampedEnd = lr.endDate > yearEnd ? yearEnd : lr.endDate;
      usedDays += countWorkingDaysInclusive(clampedStart, clampedEnd);
    }

    return {
      year,
      usedDays,
      baseDaysPerYear: policy.baseDaysPerYear,
      seniorityYearsPerBonusDay: policy.seniorityYearsPerBonusDay,
    };
  }

  // 26/10/2026: `caller` (tuy chon) - Manager chi duyet don cua thanh vien phong ban, khong tu duyet (xem assertCanDecide()).
  async approve(organizationId: string, id: string, approverId: string, dto: DecideLeaveRequestDto, caller?: ScopeCaller): Promise<LeaveRequest> {
    return this.decide(organizationId, id, approverId, LeaveRequestStatus.APPROVED, dto, EVENT_TYPES.LEAVE_REQUEST_APPROVED, caller);
  }

  async reject(organizationId: string, id: string, approverId: string, dto: DecideLeaveRequestDto, caller?: ScopeCaller): Promise<LeaveRequest> {
    return this.decide(organizationId, id, approverId, LeaveRequestStatus.REJECTED, dto, EVENT_TYPES.LEAVE_REQUEST_REJECTED, caller);
  }

  /**
   * Duyet/tu choi 1 yeu cau nghi phep - mirror pattern khoa pessimistic_write + re-check cua
   * ProjectsService.complete()/archive() (apps/project-task-service) de tranh race condition khi
   * 2 Manager cung duyet 1 yeu cau dong thoi (vd 1 duyet, 1 tu choi cung luc).
   */
  private async decide(
    organizationId: string,
    id: string,
    approverId: string,
    toStatus: LeaveRequestStatus.APPROVED | LeaveRequestStatus.REJECTED,
    dto: DecideLeaveRequestDto,
    eventType: typeof EVENT_TYPES.LEAVE_REQUEST_APPROVED | typeof EVENT_TYPES.LEAVE_REQUEST_REJECTED,
    caller?: ScopeCaller,
  ): Promise<LeaveRequest> {
    const existing = await this.leaveRequestRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Không tìm thấy yêu cầu nghỉ phép', errorCode: ERROR_CODES.LEAVE_REQUEST_NOT_FOUND });
    // 26/10/2026: chan Manager duyet don ngoai phong ban/don cua chinh minh (userId cua don khong doi nen kiem tra 1 lan o day la du).
    await assertCanDecide(this.dataSource, organizationId, caller, PERMISSIONS.LEAVE_REQUEST_APPROVE, existing.userId);
    if (existing.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException({
        message: 'Yêu cầu nghỉ phép này đã được xử lý trước đó',
        errorCode: ERROR_CODES.LEAVE_REQUEST_ALREADY_DECIDED,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const leaveRequest = await manager.findOne(LeaveRequest, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!leaveRequest) throw new NotFoundException({ message: 'Không tìm thấy yêu cầu nghỉ phép', errorCode: ERROR_CODES.LEAVE_REQUEST_NOT_FOUND });
      if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
        throw new BadRequestException({
        message: 'Yêu cầu nghỉ phép này đã được xử lý trước đó',
        errorCode: ERROR_CODES.LEAVE_REQUEST_ALREADY_DECIDED,
      });
      }

      leaveRequest.status = toStatus;
      leaveRequest.approverId = approverId;
      leaveRequest.decisionNote = dto.decisionNote ?? null;
      leaveRequest.decidedAt = new Date();
      const updated = await manager.save(leaveRequest);

      const payload: LeaveRequestApprovedPayload | LeaveRequestRejectedPayload = {
        leaveRequestId: updated.id,
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

  /**
   * Nguoi nop tu huy don nghi phep PENDING cua chinh minh. Chuyen status sang REJECTED kem decisionNote
   * de giu nguyen Postgres enum hien co, phong tranh loi lech migration enum DB.
   */
  async cancel(organizationId: string, id: string, userId: string): Promise<LeaveRequest> {
    const existing = await this.leaveRequestRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Không tìm thấy yêu cầu nghỉ phép', errorCode: ERROR_CODES.LEAVE_REQUEST_NOT_FOUND });
    if (existing.userId !== userId) {
      throw new ForbiddenException({ message: 'Bạn không có quyền hủy yêu cầu nghỉ phép này' });
    }
    if (existing.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException({
        message: 'Chỉ có thể hủy yêu cầu nghỉ phép đang chờ duyệt',
        errorCode: ERROR_CODES.LEAVE_REQUEST_ALREADY_DECIDED,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const leaveRequest = await manager.findOne(LeaveRequest, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!leaveRequest) throw new NotFoundException({ message: 'Không tìm thấy yêu cầu nghỉ phép', errorCode: ERROR_CODES.LEAVE_REQUEST_NOT_FOUND });
      if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
        throw new BadRequestException({
          message: 'Chỉ có thể hủy yêu cầu nghỉ phép đang chờ duyệt',
          errorCode: ERROR_CODES.LEAVE_REQUEST_ALREADY_DECIDED,
        });
      }

      leaveRequest.status = LeaveRequestStatus.REJECTED;
      leaveRequest.decisionNote = 'Đã hủy bởi người nộp';
      leaveRequest.decidedAt = new Date();
      const updated = await manager.save(leaveRequest);

      const payload: LeaveRequestRejectedPayload = {
        leaveRequestId: updated.id,
        userId: updated.userId,
        actorId: userId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.LEAVE_REQUEST_REJECTED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return updated;
    });
  }
}
