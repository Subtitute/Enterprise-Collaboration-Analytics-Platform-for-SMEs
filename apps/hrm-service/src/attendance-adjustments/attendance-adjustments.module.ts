import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceAdjustment } from '../entities/attendance-adjustment.entity';
import { Attendance } from '../entities/attendance.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { AttendanceAdjustmentsService } from './attendance-adjustments.service';
import { AttendanceAdjustmentsController } from './attendance-adjustments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceAdjustment, Attendance]), OutboxModule],
  providers: [AttendanceAdjustmentsService],
  controllers: [AttendanceAdjustmentsController],
  exports: [AttendanceAdjustmentsService],
})
export class AttendanceAdjustmentsModule {}
