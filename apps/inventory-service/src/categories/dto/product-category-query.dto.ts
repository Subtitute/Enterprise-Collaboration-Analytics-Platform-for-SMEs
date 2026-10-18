import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';

/** Query tim kiem danh sach danh muc san pham. */
export class ProductCategoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString({ message: 'search phai la chuoi ky tu' })
  search?: string;
}
