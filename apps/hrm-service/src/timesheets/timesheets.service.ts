import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Between, DataSource, EntityManager, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { ERROR_CODES, LeaveRequestStatus, PERMISSIONS, PaginatedResponse, TimesheetSymbol, paginate } from '@app/common-dto';
import { toGmt7DateString } from '../attendance/attendance-date.util';
import { AttendanceAdjustment, AttendanceAdjustmentStatus } from '../entities/attendance-adjustment.entity';
import { Attendance } from '../entities/attendance.entity';
import { DimUser } from '../entities/dim-user.entity';
import { LeaveRequest } from '../entities/leave-request.entity';
import { OvertimeRequest, OvertimeRequestStatus } from '../entities/overtime-request.entity';
import { TimesheetEntry } from '../entities/timesheet-entry.entity';
import { TimesheetPeriod, TimesheetPeriodStatus } from '../entities/timesheet-period.entity';
import { ScopeCaller, assertCanDecide, resolveScopeUserIds } from '../user-directory/user-directory';
import { PeriodLockService, periodLockKey } from '../work-calendar/period-lock.service';
import { WorkCalendarService } from '../work-calendar/work-calendar.service';
import { CalendarBook } from '../work-calendar/work-calendar.util';
import {
  TimesheetDay,
  TimesheetException,
  TimesheetExceptionType,
  TimesheetMonthResult,
  TimesheetRow,
  collectExceptions,
  computeMonth,
  isValidDate,
  isValidMonth,
  monthRange,
} from './timesheet-calculator';
import { LockTimesheetPeriodDto, TimesheetExceptionsQueryDto, UnlockTimesheetPeriodDto, UpsertTimesheetEntryDto } from './dto/timesheet.dto';

export interface TimesheetPeriodView {
  status: TimesheetPeriodStatus;
  lockedAt: Date | null;
  lockedByUserId: string | null;
  unlockedAt: Date | null;
  unlockReason: string | null;
}

export interface PendingCounts {
  leave: number;
  overtime: number;
  adjustment: number;
}

function toPeriodView(period: TimesheetPeriod | null): TimesheetPeriodView {
  return {
    status: period?.status ?? 'OPEN',
    lockedAt: period?.lockedAt ?? null,
    lockedByUserId: period?.lockedByUserId ?? null,
    unlockedAt: period?.unlockedAt ?? null,
    unlockReason: period?.unlockReason ?? null,
  };
}

function assertValidMonth(month: unknown): asserts month is string {
  if (!isValidMonth(month)) {
    throw new BadRequestException({ message: 'Tháng phải có dạng YYYY-MM', errorCode: ERROR_CODES.TIMESHEET_MONTH_INVALID });
  }
}

function invalidEntry(message: string): BadRequestException {
  return new BadRequestException({ message, errorCode: ERROR_CODES.TIMESHEET_ENTRY_INVALID });
}

function userNotFound(): NotFoundException {
  return new NotFoundException({ message: 'Không tìm thấy nhân viên trong phạm vi của bạn', errorCode: ERROR_CODES.USER_NOT_FOUND });
}

/**
 * 04/11/2026: bang cong va ky cong. Thang dang mo tinh truc tiep tu du lieu goc; thang da khoa doc snapshot
 * luu luc khoa roi loc theo pham vi nguoi xem. Moi phep tinh deu qua computeMonth() de bang cong, chi tiet
 * va ngoai le khong the lech nhau.
 */
@Injectable()
export class TimesheetsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly workCalendarService: WorkCalendarService,
    private readonly periodLockService: PeriodLockService,
  ) {}

  async getMonth(organizationId: string, month: string, caller: ScopeCaller) {
    assertValidMonth(month);
    const scope = await this.resolveViewScope(organizationId, caller);
    const { period, result } = await this.loadMonth(organizationId, month, scope);
    return {
      month,
      period: toPeriodView(period),
      schedule: result.schedule,
      standardDays: result.standardDays,
      rows: result.users.map((user): TimesheetRow => user.row),
    };
  }

  async getUserMonth(organizationId: string, userId: string, month: string, caller: ScopeCaller) {
    assertValidMonth(month);
    if (!isUUID(userId)) throw userNotFound();
    const scope = await this.resolveViewScope(organizationId, caller);
    if (scope && !scope.includes(userId)) throw userNotFound();

    const { period, result } = await this.loadMonth(organizationId, month, [userId]);
    const [user] = result.users;
    if (!user) throw userNotFound();
    return { month, period: toPeriodView(period), summary: user.row, days: user.days };
  }

  async getExceptions(
    organizationId: string,
    query: TimesheetExceptionsQueryDto,
    caller: ScopeCaller,
  ): Promise<PaginatedResponse<TimesheetException> & { counts: Record<TimesheetExceptionType, number>; pending: PendingCounts }> {
    assertValidMonth(query.month);
    const scope = await this.resolveViewScope(organizationId, caller);
    const { result } = await this.loadMonth(organizationId, query.month, scope);
    const { rows, counts } = collectExceptions(result.users, query.type);
    const pending = await this.countPending(this.dataSource.manager, organizationId, query.month, scope);
    const offset = (query.page - 1) * query.limit;
    return { ...paginate(rows.slice(offset, offset + query.limit), rows.length, query.page, query.limit), counts, pending };
  }

  async upsertEntry(organizationId: string, actorId: string, dto: UpsertTimesheetEntryDto, caller: ScopeCaller): Promise<TimesheetDay> {
    const { userId, workDate } = dto;
    this.assertEntryKey(userId, workDate);
    const note = typeof dto.note === 'string' ? dto.note.trim() : '';
    if (!note) throw invalidEntry('Sửa tay bắt buộc có ghi chú');
    if (!Object.values(TimesheetSymbol).includes(dto.symbol as TimesheetSymbol)) throw invalidEntry('Ký hiệu chấm công không hợp lệ');
    await assertCanDecide(this.dataSource, organizationId, caller, PERMISSIONS.ATTENDANCE_ADJUSTMENT_APPROVE, userId);

    const member = await this.dataSource.manager.findOne(DimUser, { where: { userId, organizationId } });
    if (!member) throw invalidEntry('Nhân viên không thuộc tổ chức của bạn');
    if (workDate > toGmt7DateString(new Date())) throw invalidEntry('Không thể sửa tay ngày trong tương lai');
    if (member.joinedAt && workDate < member.joinedAt) throw invalidEntry('Không thể sửa tay ngày trước ngày vào làm');

    await this.dataSource.transaction(async (manager) => {
      await this.periodLockService.assertOpen(organizationId, [workDate], manager);
      await manager.upsert(
        TimesheetEntry,
        { organizationId, userId, workDate, symbol: dto.symbol as TimesheetSymbol, note, updatedByUserId: actorId },
        ['organizationId', 'userId', 'workDate'],
      );
    });

    const month = workDate.slice(0, 7);
    const { start, end } = monthRange(month);
    const book = await this.workCalendarService.loadBook(organizationId, start, end);
    const result = await this.computeFor(this.dataSource.manager, month, organizationId, [member], book);
    return result.users[0].days.find((day) => day.date === workDate) as TimesheetDay;
  }

  async deleteEntry(organizationId: string, userId: string, workDate: string, caller: ScopeCaller): Promise<void> {
    this.assertEntryKey(userId, workDate);
    await assertCanDecide(this.dataSource, organizationId, caller, PERMISSIONS.ATTENDANCE_ADJUSTMENT_APPROVE, userId);
    await this.dataSource.transaction(async (manager) => {
      await this.periodLockService.assertOpen(organizationId, [workDate], manager);
      await manager.delete(TimesheetEntry, { organizationId, userId, workDate });
    });
  }

  /**
   * Khoa tinh cho TOAN TO CHUC, khong phu thuoc pham vi nguoi khoa. Giu khoa tu van doc quyen cua thang suot
   * giao dich: 2 nguoi khoa cung luc khong tao trung, va moi thao tac dang giu khoa chia se (assertOpen) phai
   * ket thuc truoc khi tinh snapshot - snapshot khong the bo sot don vua duoc duyet.
   */
  async lock(organizationId: string, month: string, actorId: string, dto: LockTimesheetPeriodDto) {
    assertValidMonth(month);
    if (month >= toGmt7DateString(new Date()).slice(0, 7)) {
      throw new BadRequestException({ message: 'Chỉ có thể khoá kỳ công của tháng đã kết thúc', errorCode: ERROR_CODES.TIMESHEET_PERIOD_NOT_ENDED });
    }
    const { start, end } = monthRange(month);
    const book = await this.workCalendarService.loadBook(organizationId, start, end);
    const year = Number(month.slice(0, 4));
    const monthNumber = Number(month.slice(5, 7));

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [periodLockKey(organizationId, month)]);
      const existing = await manager.findOne(TimesheetPeriod, { where: { organizationId, year, month: monthNumber } });
      if (existing?.status === 'LOCKED') {
        throw new ConflictException({ message: 'Kỳ công tháng này đã được khoá', errorCode: ERROR_CODES.TIMESHEET_PERIOD_ALREADY_LOCKED });
      }

      const pending = await this.countPending(manager, organizationId, month, null);
      if (dto.force !== true && pending.leave + pending.overtime + pending.adjustment > 0) {
        // AllExceptionsFilter chi chuyen tiep errorCode/errorParams/details nen so don phai nam trong errorParams.
        throw new ConflictException({
          message: `Còn ${pending.leave} đơn nghỉ, ${pending.overtime} đơn làm thêm và ${pending.adjustment} đơn giải trình đang chờ duyệt trong tháng này`,
          errorCode: ERROR_CODES.TIMESHEET_PERIOD_HAS_PENDING,
          errorParams: { ...pending },
        });
      }

      const users = await this.loadRoster(manager, organizationId, month, null);
      const snapshot = await this.computeFor(manager, month, organizationId, users, book);
      const period = existing ?? manager.create(TimesheetPeriod, { organizationId, year, month: monthNumber });
      period.status = 'LOCKED';
      period.lockedAt = new Date();
      period.lockedByUserId = actorId;
      period.snapshot = snapshot;
      const saved = await manager.save(period);
      return { month, period: toPeriodView(saved) };
    });
  }

  /** Mo khoa xoa snapshot, giu nguyen dong sua tay; thang lai duoc tinh truc tiep. */
  async unlock(organizationId: string, month: string, actorId: string, dto: UnlockTimesheetPeriodDto) {
    assertValidMonth(month);
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [periodLockKey(organizationId, month)]);
      const period = await manager.findOne(TimesheetPeriod, {
        where: { organizationId, year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) },
      });
      if (period?.status !== 'LOCKED') {
        throw new ConflictException({ message: 'Kỳ công tháng này chưa được khoá', errorCode: ERROR_CODES.TIMESHEET_PERIOD_NOT_LOCKED });
      }
      period.status = 'OPEN';
      period.snapshot = null;
      period.unlockedAt = new Date();
      period.unlockedByUserId = actorId;
      period.unlockReason = dto.reason.trim();
      const saved = await manager.save(period);
      return { month, period: toPeriodView(saved) };
    });
  }

  private assertEntryKey(userId: unknown, workDate: unknown): void {
    if (typeof userId !== 'string' || !isUUID(userId)) throw invalidEntry('Mã nhân viên không hợp lệ');
    if (!isValidDate(workDate) || !isValidMonth(workDate.slice(0, 7))) throw invalidEntry('Ngày công phải có dạng YYYY-MM-DD');
  }

  private resolveViewScope(organizationId: string, caller: ScopeCaller): Promise<string[] | null> {
    return resolveScopeUserIds(this.dataSource, organizationId, caller.userId, caller.permissions, PERMISSIONS.ATTENDANCE_VIEW, caller.departmentId);
  }

  /** `scope`: null = ca to chuc. Thang da khoa doc snapshot, khong tinh lai. */
  private async loadMonth(organizationId: string, month: string, scope: string[] | null): Promise<{ period: TimesheetPeriod | null; result: TimesheetMonthResult }> {
    const manager = this.dataSource.manager;
    const period = await manager.findOne(TimesheetPeriod, {
      where: { organizationId, year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) },
    });
    if (period?.status === 'LOCKED' && period.snapshot) {
      const snapshot = period.snapshot as TimesheetMonthResult;
      return { period, result: { ...snapshot, users: scope ? snapshot.users.filter((user) => scope.includes(user.row.userId)) : snapshot.users } };
    }

    const users = await this.loadRoster(manager, organizationId, month, scope);
    const { start, end } = monthRange(month);
    const book = await this.workCalendarService.loadBook(organizationId, start, end);
    return { period, result: await this.computeFor(manager, month, organizationId, users, book) };
  }

  /**
   * 04/11/2026: nhan su duoc tinh cong trong 1 thang: dang hoat dong, hoac da vo hieu hoa nhung co cham cong
   * trong thang do. Nguoi da nghi khong co cham cong thi khong bi tinh vang ca thang.
   */
  private async loadRoster(manager: EntityManager, organizationId: string, month: string, scope: string[] | null): Promise<DimUser[]> {
    const users = await manager.find(DimUser, { where: { organizationId, ...(scope ? { userId: In(scope) } : {}) } });
    const inactive = users.filter((user) => user.isActive === false).map((user) => user.userId);
    if (inactive.length === 0) return users;
    const { start, end } = monthRange(month);
    const attended = await manager.find(Attendance, {
      where: { organizationId, userId: In(inactive), workDate: Between(start, end) },
      select: { userId: true },
    });
    const attendedIds = new Set(attended.map((attendance) => attendance.userId));
    return users.filter((user) => user.isActive !== false || attendedIds.has(user.userId));
  }

  private async computeFor(manager: EntityManager, month: string, organizationId: string, users: DimUser[], book: CalendarBook): Promise<TimesheetMonthResult> {
    const { start, end } = monthRange(month);
    const userId = In(users.map((user) => user.userId));
    const now = new Date();
    return computeMonth({
      month,
      today: toGmt7DateString(now),
      now,
      book,
      users: users.map((user) => ({ userId: user.userId, departmentId: user.departmentId, joinedAt: user.joinedAt })),
      attendances: await manager.find(Attendance, {
        where: { organizationId, userId, workDate: Between(start, end) },
        select: { userId: true, workDate: true, checkInAt: true, checkOutAt: true },
      }),
      leaves: await manager.find(LeaveRequest, {
        where: { organizationId, userId, status: LeaveRequestStatus.APPROVED, startDate: LessThanOrEqual(end), endDate: MoreThanOrEqual(start) },
        order: { createdAt: 'ASC' },
      }),
      overtimes: await manager.find(OvertimeRequest, {
        where: { organizationId, userId, status: OvertimeRequestStatus.APPROVED, workDate: Between(start, end) },
      }),
      entries: await manager.find(TimesheetEntry, { where: { organizationId, userId, workDate: Between(start, end) } }),
    });
  }

  private async countPending(manager: EntityManager, organizationId: string, month: string, scope: string[] | null): Promise<PendingCounts> {
    const { start, end } = monthRange(month);
    const userFilter = scope ? { userId: In(scope) } : {};
    return {
      leave: await manager.count(LeaveRequest, {
        where: { organizationId, status: LeaveRequestStatus.PENDING, startDate: LessThanOrEqual(end), endDate: MoreThanOrEqual(start), ...userFilter },
      }),
      overtime: await manager.count(OvertimeRequest, {
        where: { organizationId, status: OvertimeRequestStatus.PENDING, workDate: Between(start, end), ...userFilter },
      }),
      adjustment: await manager.count(AttendanceAdjustment, {
        where: { organizationId, status: AttendanceAdjustmentStatus.PENDING, workDate: Between(start, end), ...userFilter },
      }),
    };
  }
}
