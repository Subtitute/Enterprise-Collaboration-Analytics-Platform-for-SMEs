import { IsIn, IsOptional } from 'class-validator';

/** GET /analytics/task-trend?range=7d|30d|quarter - Wireframe.md muc 3 va muc 7. */
export class TaskTrendQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', 'quarter'])
  range?: '7d' | '30d' | 'quarter' = '7d';
}
