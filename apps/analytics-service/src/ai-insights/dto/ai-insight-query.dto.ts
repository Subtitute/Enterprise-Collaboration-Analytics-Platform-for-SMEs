import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * GET /analytics/ai-insights?range=7d|30d|quarter&departmentId=&departmentName= - 28/07/2026,
 * tinh nang "Nhan xet AI" (xem ai-insights.service.ts). Cung quy uoc range/departmentId nhu
 * SummaryQueryDto de dung LAI ket qua da cache cua AnalyticsService.getSummary()/
 * getTaskStatusBreakdown()/getProjectProgress() (cung 1 bo tham so).
 *
 * `departmentName` la tham so RIENG chi cho tinh nang nay: Analytics Service khong so huu du
 * lieu ten phong ban (chi co departmentId - database-per-service, xem ProjectProgress ben
 * analytics.service.ts) nen KHONG THE tu resolve ten de dua vao prompt. Frontend da co san ten
 * nay (tu useDepartmentsQuery() dung cho dropdown loc) nen truyen kem, CHI DE hien thi trong doan
 * van AI sinh ra - KHONG dung cho bat ky logic loc/truy van nao (departmentId moi la gia tri
 * dung de loc). Gioi han do dai de tranh 1 chuoi qua dai lam phinh prompt gui cho Gemini.
 */
export class AiInsightQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', 'quarter'])
  range?: '7d' | '30d' | 'quarter' = '7d';

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  departmentName?: string;
}
