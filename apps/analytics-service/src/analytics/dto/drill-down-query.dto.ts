import { IsIn, IsOptional, IsUUID } from 'class-validator';

/**
 * GET /analytics/drill-down?scope=department|project&scopeId=&range=7d|30d|quarter - Layer 2
 * Diagnostic (xem AnalyticsService.getDrillDown()). Khac cac query DTO khac trong thu muc nay,
 * `scope`/`scopeId` la BAT BUOC (khong co drill-down "khong scope") - cung 3 gia tri range va
 * cung default '7d' nhu TaskTrendQueryDto.
 */
export class DrillDownQueryDto {
  @IsIn(['department', 'project'])
  scope!: 'department' | 'project';

  @IsUUID('4')
  scopeId!: string;

  @IsOptional()
  @IsIn(['7d', '30d', 'quarter'])
  range?: '7d' | '30d' | 'quarter' = '7d';
}
