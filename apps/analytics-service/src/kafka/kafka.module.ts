import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { KafkaConsumerService } from './kafka-consumer.service';
// 28/07/2026: bo sung KafkaProducerService - can de KafkaConsumerService tu phat message vao
// KAFKA_TOPICS.DLQ khi xu ly loi vinh vien/het luot retry (xem kafka-consumer.service.ts).
import { KafkaProducerService } from './kafka-producer.service';

@Module({
  imports: [AnalyticsModule, RealtimeModule],
  // 28/07/2026: dang ky them KafkaProducerService de co the inject vao constructor cua
  // KafkaConsumerService (truoc day service nay chi co provider consumer).
  providers: [KafkaConsumerService, KafkaProducerService],
})
export class KafkaModule {}
