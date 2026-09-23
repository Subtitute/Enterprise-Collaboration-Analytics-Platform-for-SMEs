import { IsIn, IsOptional } from 'class-validator';

/**
 * GET /analytics/ai-insights?range=7d|30d|quarter - tinh nang "Nhan xet AI" (xem
 * ai-insights.service.ts). Cung quy uoc `range` nhu SummaryQueryDto de dung LAI ket qua da cache
 * cua AnalyticsService.getSummary()/getProjectProgress() (cung 1 bo tham so).
 *
 * 22/09/2026: bo `departmentId`/`departmentName` - thiet ke lai tu "nhan xet cho 1 pham vi client
 * tu chon truoc" sang "AI tu quet TOAN BO to chuc (moi phong ban + top du an) va chon ra nhung
 * muc dang chu y nhat" (xem AiInsightsService.buildCandidates()) - khong con khai niem "loc theo
 * 1 phong ban" o tang API nay nua.
 */
export class AiInsightQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', 'quarter'])
  range?: '7d' | '30d' | 'quarter' = '7d';
}
