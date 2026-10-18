import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';

/** Query ton kho hien tai - loc theo kho va/hoac san pham. */
export class StockQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'warehouseId phai la UUID hop le' })
  warehouseId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'productId phai la UUID hop le' })
  productId?: string;
}
