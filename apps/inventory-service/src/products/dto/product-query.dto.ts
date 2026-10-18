import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';

/** Query tim kiem/loc danh sach san pham. */
export class ProductQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString({ message: 'search phai la chuoi ky tu' })
  search?: string;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId phai la UUID hop le' })
  categoryId?: string;
}
