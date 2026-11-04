import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequest } from '../entities/leave-request.entity';
import { LeaveBalanceAdjustment } from '../entities/leave-balance-adjustment.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { LeavePolicyModule } from '../leave-policy/leave-policy.module';
// 04/11/2026: dem ngay nghi theo lich cong ty va chan thao tac khi ky cong da khoa.
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveTypeBackfillService } from './leave-type-backfill.service';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveRequest, LeaveBalanceAdjustment]), OutboxModule, LeavePolicyModule, WorkCalendarModule],
  providers: [LeaveRequestsService, LeaveTypeBackfillService],
  controllers: [LeaveRequestsController],
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
