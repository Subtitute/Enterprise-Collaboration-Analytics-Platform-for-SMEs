import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from '../entities/calendar-event.entity';
import { TimesheetPeriod } from '../entities/timesheet-period.entity';
import { WorkSchedule } from '../entities/work-schedule.entity';
import { PeriodLockService } from './period-lock.service';
import { WorkCalendarController } from './work-calendar.controller';
import { WorkCalendarService } from './work-calendar.service';

/** 04/11/2026: lich lam viec, bo tra cuu ngay va chot khoa ky cong - xem work-calendar.service.ts. */
@Module({
  imports: [TypeOrmModule.forFeature([WorkSchedule, CalendarEvent, TimesheetPeriod])],
  providers: [WorkCalendarService, PeriodLockService],
  controllers: [WorkCalendarController],
  exports: [WorkCalendarService, PeriodLockService],
})
export class WorkCalendarModule {}
