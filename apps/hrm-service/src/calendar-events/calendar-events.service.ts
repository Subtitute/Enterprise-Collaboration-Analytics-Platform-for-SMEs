import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { CalendarEventCreatedPayload, CalendarEventDeletedPayload, CalendarEventType, ERROR_CODES, EVENT_TYPES } from '@app/common-dto';
import { CalendarEvent } from '../entities/calendar-event.entity';
import { OutboxService } from '../outbox/outbox.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CalendarEventQueryDto } from './dto/calendar-event-query.dto';

const PRODUCER = 'hrm-service';

/** Lich cong ty (HRM-lite mo rong) - ngay le + su kien/dat lich, chi Org Admin quan ly (PERMISSIONS.CALENDAR_MANAGE). */
@Injectable()
export class CalendarEventsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(CalendarEvent) private readonly calendarEventRepo: Repository<CalendarEvent>,
    private readonly outboxService: OutboxService,
  ) {}

  private assertValidRange(startDate: string, endDate: string): void {
    if (new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException({
        message: 'Ngày bắt đầu không được sau ngày kết thúc',
        errorCode: ERROR_CODES.CALENDAR_EVENT_DATE_RANGE_INVALID,
      });
    }
  }

  async create(organizationId: string, userId: string, dto: CreateCalendarEventDto): Promise<CalendarEvent> {
    // 15/09/2026: endDate tuy chon o DTO - mac dinh = startDate (muc lich 1 ngay, truong hop pho
    // bien nhat: 1 ngay le don le hoac 1 su kien trong ngay).
    const endDate = dto.endDate ?? dto.startDate;
    this.assertValidRange(dto.startDate, endDate);

    return this.dataSource.transaction(async (manager) => {
      const calendarEvent = await manager.save(
        manager.create(CalendarEvent, {
          organizationId,
          title: dto.title,
          description: dto.description ?? null,
          type: dto.type,
          startDate: dto.startDate,
          endDate,
          createdByUserId: userId,
        }),
      );

      const payload: CalendarEventCreatedPayload = {
        calendarEventId: calendarEvent.id,
        title: calendarEvent.title,
        type: calendarEvent.type,
        startDate: calendarEvent.startDate,
        endDate: calendarEvent.endDate,
        actorId: userId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.CALENDAR_EVENT_CREATED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return calendarEvent;
    });
  }

  /**
   * Loc theo khoang thoi gian dang xem (vd 1 thang tren luoi lich) - tra ve moi muc lich CHONG LAN
   * voi khoang [startDate, endDate] da cho (khong chi cac muc BAT DAU trong khoang do, vi 1 muc
   * lich nhieu ngay - vd Tet - co the bat dau TRUOC khoang dang xem nhung van con "dang dien ra"
   * trong khoang do). De trong ca 2 tham so = tra ve toan bo (xem chu thich tai CalendarEventQueryDto).
   */
  async findAll(organizationId: string, query: CalendarEventQueryDto): Promise<CalendarEvent[]> {
    const where: Record<string, unknown> = { organizationId };
    if (query.startDate) where.endDate = MoreThanOrEqual(query.startDate);
    if (query.endDate) where.startDate = LessThanOrEqual(query.endDate);

    return this.calendarEventRepo.find({ where, order: { startDate: 'ASC' } });
  }

  /**
   * 17/09/2026: tra ve muc lich HOLIDAY dang "hieu luc" tai 1 ngay cu the (startDate <= dateStr <=
   * endDate), hoac null neu khong co - dung boi AttendanceService.checkIn() de chan cham cong vao
   * ngay nghi le cong ty (Org Admin khai bao qua Lich cong ty, xem chu thich tai attendance.service.ts).
   */
  async findHolidayForDate(organizationId: string, dateStr: string): Promise<CalendarEvent | null> {
    return this.calendarEventRepo.findOne({
      where: {
        organizationId,
        type: CalendarEventType.HOLIDAY,
        startDate: LessThanOrEqual(dateStr),
        endDate: MoreThanOrEqual(dateStr),
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateCalendarEventDto): Promise<CalendarEvent> {
    const existing = await this.calendarEventRepo.findOne({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException({ message: 'Không tìm thấy mục lịch', errorCode: ERROR_CODES.CALENDAR_EVENT_NOT_FOUND });
    }

    const nextStartDate = dto.startDate ?? existing.startDate;
    const nextEndDate = dto.endDate ?? existing.endDate;
    this.assertValidRange(nextStartDate, nextEndDate);

    if (dto.title !== undefined) existing.title = dto.title;
    if (dto.description !== undefined) existing.description = dto.description;
    if (dto.type !== undefined) existing.type = dto.type;
    existing.startDate = nextStartDate;
    existing.endDate = nextEndDate;

    return this.calendarEventRepo.save(existing);
  }

  async delete(organizationId: string, id: string, userId: string): Promise<void> {
    const existing = await this.calendarEventRepo.findOne({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException({ message: 'Không tìm thấy mục lịch', errorCode: ERROR_CODES.CALENDAR_EVENT_NOT_FOUND });
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(CalendarEvent, { id, organizationId });

      const payload: CalendarEventDeletedPayload = {
        calendarEventId: existing.id,
        title: existing.title,
        actorId: userId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.CALENDAR_EVENT_DELETED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });
    });
  }
}
