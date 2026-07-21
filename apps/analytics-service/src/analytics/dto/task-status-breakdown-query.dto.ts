import { IsIn, IsOptional, IsUUID } from 'class-validator';

/**
 * GET /analytics/task-status-breakdown?projectId=&range=7d|30d|quarter - loc theo du an (tuy
 * chon) va theo khoang thoi gian task duoc tao (Wireframe.md muc 3, muc 7 - "Khoang thoi gian").
 * Cung 3 gia tri va cung default '7d' nhu TaskTrendQueryDto.
 */
export class TaskStatusBreakdownQueryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsIn(['7d', '30d', 'quarter'])
  range?: '7d' | '30d' | 'quarter' = '7d';
}
