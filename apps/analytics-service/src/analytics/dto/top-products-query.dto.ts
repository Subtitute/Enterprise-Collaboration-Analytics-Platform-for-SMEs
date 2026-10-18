import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/** GET /analytics/top-products?range=7d|30d&limit=5 - Technical_Spec.md muc 22. */
export class TopProductsQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d'])
  range?: '7d' | '30d' = '7d';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}
