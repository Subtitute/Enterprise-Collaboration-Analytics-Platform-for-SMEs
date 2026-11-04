import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OvertimeRequest } from '../entities/overtime-request.entity';
import { OutboxModule } from '../outbox/outbox.module';
// 04/11/2026: chan thao tac khi ky cong da khoa.
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { OvertimeRequestsService } from './overtime-requests.service';
import { OvertimeRequestsController } from './overtime-requests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OvertimeRequest]), OutboxModule, WorkCalendarModule],
  providers: [OvertimeRequestsService],
  controllers: [OvertimeRequestsController],
  exports: [OvertimeRequestsService],
})
export class OvertimeRequestsModule {}
