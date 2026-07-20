import { IsIn, IsOptional } from 'class-validator';

/** GET /analytics/document-activity?range=7d|30d */
export class DocumentActivityQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d'])
  range?: '7d' | '30d' = '7d';
}
