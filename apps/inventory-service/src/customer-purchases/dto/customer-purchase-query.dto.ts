import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';

/** Query danh sach giao dich - loc theo khach hang va/hoac san pham. */
export class CustomerPurchaseQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'customerId phai la UUID hop le' })
  customerId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'productId phai la UUID hop le' })
  productId?: string;
}
