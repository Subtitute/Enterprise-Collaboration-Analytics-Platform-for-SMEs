import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { FactWriterService } from './fact-writer.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, FactWriterService],
  // FactWriterService duoc KafkaModule dung de ghi fact table tu Kafka consumer.
  // 28/07/2026: export them AnalyticsService - AiInsightsModule (tinh nang "Nhan xet AI") tai su
  // dung nguyen getSummary/getTaskStatusBreakdown/getProjectProgress thay vi viet lai truy van.
  exports: [FactWriterService, AnalyticsService],
})
export class AnalyticsModule {}
