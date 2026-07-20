import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { KafkaConsumerService } from './kafka-consumer.service';

@Module({
  imports: [AnalyticsModule, RealtimeModule],
  providers: [KafkaConsumerService],
})
export class KafkaModule {}
