import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import { CalendarEventType, ERROR_CODES } from '@app/common-dto';
import { CalendarEvent } from '../entities/calendar-event.entity';
import { WorkSchedule } from '../entities/work-schedule.entity';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';
import {
  CalendarBook,
  HolidayEntry,
  buildCalendarBook,
  computeHoursPerDay,
  countWorkingDays,
  daysInclusive,
  findWorkScheduleError,
  listHolidays,
} from './work-calendar.util';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const MAX_RANGE_DAYS = 366;
const SCHEDULE_FIELDS = ['workingWeekdays', 'workStart', 'workEnd', 'lateGraceMinutes', 'earlyLeaveGraceMinutes', 'breakMinutes'] as const;

export type WorkScheduleView = WorkSchedule & { hoursPerDay: number };

/** 04/11/2026: lich lam viec cua to chuc va bo tra cuu ngay dung chung cho don nghi, so du phep, bang cong. */
@Injectable()
export class WorkCalendarService {
  constructor(
    @InjectRepository(WorkSchedule) private readonly scheduleRepo: Repository<WorkSchedule>,
    @InjectRepository(CalendarEvent) private readonly calendarEventRepo: Repository<CalendarEvent>,
  ) {}

  /** Mirror LeavePolicyService.getOrCreate(): 2 request dau tien dong thoi van chi tao 1 dong. */
  async getOrCreateSchedule(organizationId: string): Promise<WorkSchedule> {
    const existing = await this.scheduleRepo.findOne({ where: { organizationId } });
    if (existing) return existing;

    try {
      return await this.scheduleRepo.save(this.scheduleRepo.create({ organizationId }));
    } catch (error) {
      const pgErrorCode = error instanceof QueryFailedError ? (error.driverError as { code?: string } | undefined)?.code : undefined;
      if (pgErrorCode === POSTGRES_UNIQUE_VIOLATION) {
        const race = await this.scheduleRepo.findOne({ where: { organizationId } });
        if (race) return race;
      }
      throw error;
    }
  }

  async getSchedule(organizationId: string): Promise<WorkScheduleView> {
    return this.toView(await this.getOrCreateSchedule(organizationId));
  }

  async updateSchedule(organizationId: string, dto: UpdateWorkScheduleDto): Promise<WorkScheduleView> {
    const schedule = await this.getOrCreateSchedule(organizationId);
    for (const field of SCHEDULE_FIELDS) {
      if (dto[field] !== undefined) (schedule as unknown as Record<string, unknown>)[field] = dto[field];
    }
    const message = findWorkScheduleError(schedule);
    if (message) throw new BadRequestException({ message, errorCode: ERROR_CODES.WORK_SCHEDULE_INVALID });

    schedule.workingWeekdays = [...schedule.workingWeekdays].sort((a, b) => a - b);
    return this.toView(await this.scheduleRepo.save(schedule));
  }

  /** Nap lich va cac ngay le/lam bu cham vao [from, to] 1 lan; `from`, `to` dang 'YYYY-MM-DD'. */
  async loadBook(organizationId: string, from: string, to: string): Promise<CalendarBook> {
    const schedule = await this.getOrCreateSchedule(organizationId);
    const events = await this.calendarEventRepo.find({
      where: {
        organizationId,
        type: In([CalendarEventType.HOLIDAY, CalendarEventType.MAKEUP_WORKDAY]),
        startDate: LessThanOrEqual(to),
        endDate: MoreThanOrEqual(from),
      },
      order: { startDate: 'ASC' },
    });
    return buildCalendarBook(schedule, events, from, to);
  }

  async summarizeRange(organizationId: string, startDate: string, endDate: string): Promise<{ workingDays: number; holidays: HolidayEntry[] }> {
    const start = startDate.slice(0, 10);
    const end = endDate.slice(0, 10);
    if (start > end) {
      throw new BadRequestException({ message: 'Ngày bắt đầu không được sau ngày kết thúc', errorCode: ERROR_CODES.LEAVE_DATE_RANGE_INVALID });
    }
    if (daysInclusive(start, end) > MAX_RANGE_DAYS) {
      throw new BadRequestException({
        message: `Khoảng ngày tối đa ${MAX_RANGE_DAYS} ngày`,
        errorCode: ERROR_CODES.VALIDATION_INVALID,
        errorParams: { field: 'endDate' },
      });
    }
    const book = await this.loadBook(organizationId, start, end);
    return { workingDays: countWorkingDays(book, start, end), holidays: listHolidays(book, start, end) };
  }

  private toView(schedule: WorkSchedule): WorkScheduleView {
    return { ...schedule, hoursPerDay: computeHoursPerDay(schedule) };
  }
}
