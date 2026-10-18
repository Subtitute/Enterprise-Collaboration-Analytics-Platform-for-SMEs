import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';

/** Query lich su bien dong kho - loc theo kho va/hoac san pham. */
export class StockMovementQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'warehouseId phai la UUID hop le' })
  warehouseId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'productId phai la UUID hop le' })
  productId?: string;
}
