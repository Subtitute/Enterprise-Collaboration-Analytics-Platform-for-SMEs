import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, EntityManager, FindOperator, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import {
  ERROR_CODES,
  EVENT_TYPES,
  LEAVE_TYPE_RULES,
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
import { LeaveBalanceAdjustment } from '../entities/leave-balance-adjustment.entity';
import { DimUser } from '../entities/dim-user.entity';
import { OutboxService } from '../outbox/outbox.service';
import { toGmt7DateString } from '../attendance/attendance-date.util';
import { LeavePolicyService } from '../leave-policy/leave-policy.service';
import { WorkCalendarService } from '../work-calendar/work-calendar.service';
import { PeriodLockService } from '../work-calendar/period-lock.service';
import { CalendarBook, countWorkingDays, countWorkingDaysInYear, monthProbes, yearsInRange } from '../work-calendar/work-calendar.util';
import { LeavePolicyRules, YearBalance, computeYearBalance } from './leave-balance.util';
import { inferLeaveTypeFromReason } from './leave-type.util';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto';
import { LeaveRequestQueryDto } from './dto/leave-request-query.dto';
import { CreateBalanceAdjustmentDto } from './dto/create-balance-adjustment.dto';
import { BalanceAdjustmentQueryDto } from './dto/balance-adjustment-query.dto';

const PRODUCER = 'hrm-service';
const MIN_ADJUSTMENT_YEAR = 2000;
const MAX_ADJUSTMENT_YEAR = 2100;
const MAX_ADJUSTMENT_DAYS = 366;
const MAX_ADJUSTMENTS_LISTED = 200;

/**
 * GET /leave-requests/me/balance - xem LeaveRequestsService.getMyBalance().
 * 04/11/2026: may chu tinh luon thuc huong va con lai (YearBalance), giu 2 truong chinh sach cu.
 */
export interface LeaveBalance extends YearBalance {
  baseDaysPerYear: number;
  seniorityYearsPerBonusDay: number;
}

/** 04/11/2026: don nghi kem so ngay lam viec tinh theo lich cong ty. */
export type LeaveRequestWithDays = LeaveRequest & { workingDays: number };

@Injectable()
export class LeaveRequestsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(LeaveRequest) private readonly leaveRequestRepo: Repository<LeaveRequest>,
    @InjectRepository(LeaveBalanceAdjustment) private readonly adjustmentRepo: Repository<LeaveBalanceAdjustment>,
    private readonly outboxService: OutboxService,
    private readonly leavePolicyService: LeavePolicyService,
    private readonly workCalendarService: WorkCalendarService,
    private readonly periodLockService: PeriodLockService,
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

    // 04/11/2026: loai nghi, ngay lam viec, trung don, so du. Lich va chinh sach nap ngoai giao dich vi
    // getOrCreate co the gap 23505 - loi do se lam hong giao dich dang mo.
    const startDate = dto.startDate.slice(0, 10);
    const endDate = dto.endDate.slice(0, 10);
    const leaveType = dto.leaveType ?? inferLeaveTypeFromReason(dto.reason);
    const book = await this.loadBookForYears(organizationId, startDate, endDate);
    if (countWorkingDays(book, startDate, endDate) === 0) {
      throw new BadRequestException({ message: 'Khoảng ngày đã chọn không có ngày làm việc nào', errorCode: ERROR_CODES.LEAVE_NO_WORKING_DAYS });
    }
    const policy = LEAVE_TYPE_RULES[leaveType].deductsBalance ? await this.leavePolicyService.getOrCreate(organizationId) : null;

    return this.dataSource.transaction(async (manager) => {
      await this.lockUserLeave(manager, organizationId, userId);

      const overlapping = await manager.findOne(LeaveRequest, {
        where: {
          organizationId,
          userId,
          status: In([LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED]),
          startDate: LessThanOrEqual(endDate),
          endDate: MoreThanOrEqual(startDate),
        },
      });
      if (overlapping) {
        throw new ConflictException({ message: 'Khoảng ngày này trùng với một đơn nghỉ đang chờ duyệt hoặc đã duyệt của bạn', errorCode: ERROR_CODES.LEAVE_OVERLAP });
      }
      if (policy) await this.assertWithinBalance(manager, organizationId, userId, { startDate, endDate }, book, policy);

      const leaveRequest = await manager.save(
        manager.create(LeaveRequest, {
          organizationId,
          userId,
          startDate,
          endDate,
          reason: dto.reason,
          leaveType,
          status: LeaveRequestStatus.PENDING,
        }),
      );

      const payload: LeaveRequestCreatedPayload = {
        leaveRequestId: leaveRequest.id,
        userId,
        startDate,
        endDate,
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

  async findMine(organizationId: string, userId: string, query: LeaveRequestQueryDto): Promise<PaginatedResponse<LeaveRequestWithDays>> {
    const [data, total] = await this.leaveRequestRepo.findAndCount({
      where: { organizationId, userId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(await this.withWorkingDays(organizationId, data), total, query.page, query.limit);
  }

  /**
   * Danh sach nghi phep TOAN TO CHUC (Manager/Org Admin, PERMISSIONS.LEAVE_REQUEST_VIEW) - loc
   * duoc theo userId/status. 03/10/2026: truyen userId ma KHONG truyen status = lich su nghi phep
   * DAY DU (moi trang thai) cua RIENG 1 nhan vien - xem chu thich tai LeaveRequestQueryDto.
   *
   * 26/10/2026: `caller` (tuy chon) - Manager chi xem don cua chinh minh + thanh vien phong ban
   * (read-model dim_user), khong con toan to chuc; Org Admin (USER_MANAGE) giu nguyen.
   */
  async findAll(organizationId: string, query: LeaveRequestQueryDto, caller?: ScopeCaller): Promise<PaginatedResponse<LeaveRequestWithDays>> {
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
    return paginate(await this.withWorkingDays(organizationId, data), total, query.page, query.limit);
  }

  /**
   * 22/09/2026: So du phep nam hien tai (HRM-lite mo rong, theo de xuat cua Tien: "Số dư phép -
   * Theo dõi còn/đã dùng - Cập nhật realtime sau khi duyệt").
   *
   * 04/11/2026: may chu tinh tron so du - ngay vao lam da co trong dim_user nen khong con phai ghep o
   * frontend; dem ngay theo lich cong ty thay cho Thu 2 - Thu 6 co dinh. Cung 1 cach tinh voi kiem tra
   * luc tao/duyet don (loadYearBalances) de so hien thi khong lech so dung de chan.
   */
  async getMyBalance(organizationId: string, userId: string): Promise<LeaveBalance> {
    const policy = await this.leavePolicyService.getOrCreate(organizationId);
    const year = Number(toGmt7DateString(new Date()).slice(0, 4));
    const book = await this.workCalendarService.loadBook(organizationId, `${year}-01-01`, `${year}-12-31`);
    const [balance] = await this.loadYearBalances(this.dataSource.manager, organizationId, userId, [year], book, policy);
    return { ...balance, baseDaysPerYear: policy.baseDaysPerYear, seniorityYearsPerBonusDay: policy.seniorityYearsPerBonusDay };
  }

  /** 04/11/2026: Org Admin dieu chinh so phep cua 1 nhan vien, chi them moi. */
  async createBalanceAdjustment(organizationId: string, actorId: string, dto: CreateBalanceAdjustmentDto): Promise<LeaveBalanceAdjustment> {
    const note = typeof dto.note === 'string' ? dto.note.trim() : '';
    const isValid =
      isUUID(dto.userId) &&
      Number.isInteger(dto.year) &&
      dto.year >= MIN_ADJUSTMENT_YEAR &&
      dto.year <= MAX_ADJUSTMENT_YEAR &&
      Number.isInteger(dto.days) &&
      dto.days !== 0 &&
      Math.abs(dto.days) <= MAX_ADJUSTMENT_DAYS &&
      note !== '';
    if (!isValid) {
      throw new BadRequestException({
        message: `Điều chỉnh phép không hợp lệ: số ngày phải là số nguyên khác 0 (tối đa ${MAX_ADJUSTMENT_DAYS}), năm hợp lệ và bắt buộc có ghi chú`,
        errorCode: ERROR_CODES.LEAVE_ADJUSTMENT_INVALID,
      });
    }
    const member = await this.dataSource.getRepository(DimUser).findOne({ where: { userId: dto.userId, organizationId } });
    if (!member) {
      throw new BadRequestException({ message: 'Nhân viên không thuộc tổ chức của bạn', errorCode: ERROR_CODES.LEAVE_ADJUSTMENT_INVALID });
    }

    return this.adjustmentRepo.save(
      this.adjustmentRepo.create({ organizationId, userId: dto.userId, year: dto.year, days: dto.days, note, createdByUserId: actorId }),
    );
  }

  async findBalanceAdjustments(organizationId: string, query: BalanceAdjustmentQueryDto): Promise<LeaveBalanceAdjustment[]> {
    return this.adjustmentRepo.find({
      where: {
        organizationId,
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.year !== undefined ? { year: query.year } : {}),
      },
      order: { createdAt: 'DESC' },
      take: MAX_ADJUSTMENTS_LISTED,
    });
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
   *
   * 04/11/2026: duyet phep nam phai kiem tra lai so du (chinh sach/dieu chinh co the da doi tu luc tao
   * don); ca duyet lan tu choi deu bi chan khi thang cua don da khoa ky cong.
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

    // 04/11/2026: nap ngoai giao dich, ly do nhu trong create().
    const isApproving = toStatus === LeaveRequestStatus.APPROVED;
    const needsBalanceCheck = isApproving && LEAVE_TYPE_RULES[existing.leaveType].deductsBalance;
    const book = needsBalanceCheck ? await this.loadBookForYears(organizationId, existing.startDate, existing.endDate) : null;
    const policy = needsBalanceCheck ? await this.leavePolicyService.getOrCreate(organizationId) : null;

    return this.dataSource.transaction(async (manager) => {
      // 04/11/2026: khoa theo nguoi TRUOC khoa dong (khop thu tu trong create()) de khong the deadlock va
      // 2 don cua cung 1 nguoi khong duoc duyet song song cung vuot so du.
      if (isApproving) await this.lockUserLeave(manager, organizationId, existing.userId);

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

      await this.periodLockService.assertOpen(organizationId, monthProbes(leaveRequest.startDate, leaveRequest.endDate), manager);
      if (book && policy) await this.assertWithinBalance(manager, organizationId, leaveRequest.userId, leaveRequest, book, policy);

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

  /** 04/11/2026: serialize moi kiem tra trung don/so du cua 1 nguoi, giai phong khi giao dich ket thuc. */
  private async lockUserLeave(manager: EntityManager, organizationId: string, userId: string): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`leave:${organizationId}:${userId}`]);
  }

  /** 04/11/2026: lich cua tron cac nam ma don cham toi - du de dem ca don khac cua nguoi do trong nhung nam ay. */
  private loadBookForYears(organizationId: string, startDate: string, endDate: string): Promise<CalendarBook> {
    return this.workCalendarService.loadBook(organizationId, `${startDate.slice(0, 4)}-01-01`, `${endDate.slice(0, 4)}-12-31`);
  }

  /** 04/11/2026: `book` phai phu tron cac nam trong `years`. `excludeRequestId` xem computeYearBalance(). */
  private async loadYearBalances(
    manager: EntityManager,
    organizationId: string,
    userId: string,
    years: number[],
    book: CalendarBook,
    policy: LeavePolicyRules,
    excludeRequestId?: string,
  ): Promise<YearBalance[]> {
    const requests = await manager.find(LeaveRequest, {
      where: {
        organizationId,
        userId,
        status: In([LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED]),
        startDate: LessThanOrEqual(`${years[years.length - 1]}-12-31`),
        endDate: MoreThanOrEqual(`${years[0]}-01-01`),
      },
    });
    const adjustments = await manager.find(LeaveBalanceAdjustment, { where: { organizationId, userId, year: In(years) } });
    const member = await manager.findOne(DimUser, { where: { userId, organizationId } });
    const today = toGmt7DateString(new Date());

    return years.map((year) =>
      computeYearBalance({
        year,
        today,
        joinedAt: member?.joinedAt,
        policy,
        adjustmentDays: adjustments.filter((adjustment) => adjustment.year === year).reduce((sum, adjustment) => sum + adjustment.days, 0),
        requests,
        book,
        excludeRequestId,
      }),
    );
  }

  /**
   * 04/11/2026: voi tung nam ma don cham toi: da duyet + dang cho + don nay khong duoc vuot thuc huong. Nam
   * chi bi cham boi ngay khong phai ngay lam viec (vd don ket thuc vao 01/01 la ngay le) khong bi xet.
   */
  private async assertWithinBalance(
    manager: EntityManager,
    organizationId: string,
    userId: string,
    request: { id?: string; startDate: string; endDate: string },
    book: CalendarBook,
    policy: LeavePolicyRules,
  ): Promise<void> {
    const years = yearsInRange(request.startDate, request.endDate);
    const balances = await this.loadYearBalances(manager, organizationId, userId, years, book, policy, request.id);
    for (const balance of balances) {
      const requestedDays = countWorkingDaysInYear(book, request.startDate, request.endDate, balance.year);
      if (requestedDays > 0 && requestedDays > balance.remainingDays) {
        const remainingDays = Math.max(0, balance.remainingDays);
        throw new BadRequestException({
          message: `Số ngày nghỉ vượt quá số phép còn lại của năm ${balance.year}: cần ${requestedDays} ngày, còn ${remainingDays} ngày`,
          errorCode: ERROR_CODES.LEAVE_BALANCE_EXCEEDED,
          errorParams: { year: balance.year, requestedDays, remainingDays },
        });
      }
    }
  }

  /** 04/11/2026: nap lich 1 lan cho ca trang roi dem cho tung don. */
  private async withWorkingDays(organizationId: string, rows: LeaveRequest[]): Promise<LeaveRequestWithDays[]> {
    if (rows.length === 0) return [];
    const from = rows.reduce((min, row) => (row.startDate < min ? row.startDate : min), rows[0].startDate);
    const to = rows.reduce((max, row) => (row.endDate > max ? row.endDate : max), rows[0].endDate);
    const book = await this.workCalendarService.loadBook(organizationId, from, to);
    return rows.map((row) => ({ ...row, workingDays: countWorkingDays(book, row.startDate, row.endDate) }));
  }
}
