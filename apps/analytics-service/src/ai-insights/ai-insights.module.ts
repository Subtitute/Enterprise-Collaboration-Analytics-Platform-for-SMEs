import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AiInsightsController } from './ai-insights.controller';
import { AiInsightsService } from './ai-insights.service';

// 28/07/2026: AnalyticsModule phai export AnalyticsService (xem ghi chu tai analytics.module.ts)
// de AiInsightsService tai su dung nguyen getSummary/getTaskStatusBreakdown/getProjectProgress
// thay vi viet lai truy van TimescaleDB rieng. Khong can import RedisModule o day - da
// @Global() (xem redis/redis.module.ts), cung quy uoc voi AnalyticsModule.
@Module({
  imports: [AnalyticsModule],
  controllers: [AiInsightsController],
  providers: [AiInsightsService],
})
export class AiInsightsModule {}
