import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { FactWriterService } from './fact-writer.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, FactWriterService],
  // FactWriterService duoc KafkaModule dung de ghi fact table tu Kafka consumer.
  exports: [FactWriterService],
})
export class AnalyticsModule {}
