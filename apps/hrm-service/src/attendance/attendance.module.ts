import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from '../entities/attendance.entity';
import { OutboxModule } from '../outbox/outbox.module';
// 17/09/2026: chan cham cong vao ngay nghi le cong ty - can CalendarEventsService.findHolidayForDate()
// (xem attendance.service.ts). CalendarEventsModule da export san CalendarEventsService.
import { CalendarEventsModule } from '../calendar-events/calendar-events.module';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance]), OutboxModule, CalendarEventsModule],
  providers: [AttendanceService],
  controllers: [AttendanceController],
  exports: [AttendanceService],
})
export class AttendanceModule {}
