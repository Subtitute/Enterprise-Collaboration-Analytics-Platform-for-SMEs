import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceAdjustment } from '../entities/attendance-adjustment.entity';
import { Attendance } from '../entities/attendance.entity';
import { OutboxModule } from '../outbox/outbox.module';
// 04/11/2026: chan thao tac khi ky cong da khoa.
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { AttendanceAdjustmentsService } from './attendance-adjustments.service';
import { AttendanceAdjustmentsController } from './attendance-adjustments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceAdjustment, Attendance]), OutboxModule, WorkCalendarModule],
  providers: [AttendanceAdjustmentsService],
  controllers: [AttendanceAdjustmentsController],
  exports: [AttendanceAdjustmentsService],
})
export class AttendanceAdjustmentsModule {}
