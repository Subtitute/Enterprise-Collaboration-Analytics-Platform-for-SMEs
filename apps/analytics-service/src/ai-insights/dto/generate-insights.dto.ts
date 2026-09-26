import { IsArray, IsIn, IsOptional } from 'class-validator';

/**
 * POST /analytics/ai-insights - Layer 5 Recommendation Engine (xem ai-insights.service.ts).
 * Mirror `range` cua AiInsightQueryDto (GET cu, khong doi). `anomalies` la TUY CHON - frontend tu
 * goi POST /ml/anomalies (apps/ml-service) TRUOC, roi truyen ket qua vao day de lam giau prompt -
 * analytics-service KHONG tu goi HTTP sang ml-service (database-per-service, khong co co che goi
 * noi bo xuyen service trong du an nay). Khong dung @ValidateNested/@Type (chua co tien le trong
 * repo cho DTO long nhau) - day la du lieu ngu canh CHO PROMPT (khong luu xuong DB, rui ro thap),
 * validate nong o tang top-level la du.
 */
export class GenerateInsightsDto {
  @IsOptional()
  @IsIn(['7d', '30d', 'quarter'])
  range?: '7d' | '30d' | 'quarter' = '7d';

  @IsOptional()
  @IsArray()
  anomalies?: Array<{
    metrics: { totalTasks: number; completionRate: number; overdueTasks: number; attendanceRate: number };
    topDeviation: { metric: string; value: number; teamAverage: number; direction: 'down' | 'up' };
  }>;
}
