import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { OutboxService } from './outbox.service';
import { OutboxPublisherJob } from './outbox-publisher.job';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  providers: [OutboxService, OutboxPublisherJob],
  exports: [OutboxService],
})
export class OutboxModule {}
