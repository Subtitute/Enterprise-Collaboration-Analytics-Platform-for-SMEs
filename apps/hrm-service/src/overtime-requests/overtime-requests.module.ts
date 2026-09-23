import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OvertimeRequest } from '../entities/overtime-request.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { OvertimeRequestsService } from './overtime-requests.service';
import { OvertimeRequestsController } from './overtime-requests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OvertimeRequest]), OutboxModule],
  providers: [OvertimeRequestsService],
  controllers: [OvertimeRequestsController],
  exports: [OvertimeRequestsService],
})
export class OvertimeRequestsModule {}
