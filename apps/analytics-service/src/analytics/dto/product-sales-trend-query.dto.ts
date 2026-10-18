import { IsIn, IsOptional } from 'class-validator';

/** GET /analytics/product-sales-trend?range=7d|30d - Technical_Spec.md muc 22. */
export class ProductSalesTrendQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d'])
  range?: '7d' | '30d' = '7d';
}
