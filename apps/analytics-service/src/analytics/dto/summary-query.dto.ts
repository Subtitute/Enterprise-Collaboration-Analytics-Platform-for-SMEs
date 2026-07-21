import { IsIn, IsOptional } from 'class-validator';

/**
 * GET /analytics/summary?range=7d|30d|quarter - Wireframe.md muc 3, muc 7 ("Khoang thoi gian").
 * Cung 3 gia tri va cung default '7d' nhu TaskTrendQueryDto de dong bo giua cac chart/KPI-card
 * tren cung 1 trang Dashboard/Bao cao & Phan tich.
 */
export class SummaryQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', 'quarter'])
  range?: '7d' | '30d' | 'quarter' = '7d';
}
