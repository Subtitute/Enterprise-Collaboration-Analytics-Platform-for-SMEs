import { IsIn, IsOptional, IsUUID } from 'class-validator';

/**
 * GET /analytics/project-progress?range=7d|30d|quarter&departmentId= - Wireframe.md muc 3, muc 7
 * ("Khoang thoi gian"). Cung 3 gia tri va cung default '7d' nhu TaskTrendQueryDto.
 */
export class ProjectProgressQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', 'quarter'])
  range?: '7d' | '30d' | 'quarter' = '7d';

  // 28/07/2026: loc tien do du an theo phong ban (tuy chon) - xem AnalyticsService.getProjectProgress().
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;
}
