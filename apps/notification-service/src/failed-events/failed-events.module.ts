import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FailedEvent, FailedEventSchema } from './schemas/failed-event.schema';
import { FailedEventsService } from './failed-events.service';
import { FailedEventsConsumerService } from './failed-events-consumer.service';
import { FailedEventsController } from './failed-events.controller';

/**
 * 28/07/2026: module moi - man hinh quan tri "Danh sach su kien loi" (Technical_Spec.md muc 14 -
 * nang cap Dead Letter Queue). MAU THAM CHIEU: notifications/notifications.module.ts (Mongoose
 * forFeature + controller + service), khac o cho co them FailedEventsConsumerService (Kafka
 * consumer RIENG cho topic DLQ - xem ghi chu trong failed-events-consumer.service.ts).
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: FailedEvent.name, schema: FailedEventSchema }])],
  providers: [FailedEventsService, FailedEventsConsumerService],
  controllers: [FailedEventsController],
})
export class FailedEventsModule {}
