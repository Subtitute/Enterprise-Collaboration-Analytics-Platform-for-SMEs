import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequest } from '../entities/leave-request.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { LeavePolicyModule } from '../leave-policy/leave-policy.module';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequestsController } from './leave-requests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveRequest]), OutboxModule, LeavePolicyModule],
  providers: [LeaveRequestsService],
  controllers: [LeaveRequestsController],
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
