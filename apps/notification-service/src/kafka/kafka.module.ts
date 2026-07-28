import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { KafkaConsumerService } from './kafka-consumer.service';
// 28/07/2026: dang ky them KafkaProducerService de KafkaConsumerService inject duoc - dung de day
// message loi vao KAFKA_TOPICS.DLQ (Technical_Spec.md muc 14 - nang cap Dead Letter Queue).
import { KafkaProducerService } from './kafka-producer.service';

@Module({
  imports: [NotificationsModule],
  providers: [KafkaConsumerService, KafkaProducerService],
})
export class KafkaModule {}
