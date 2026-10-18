import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';

/** Query tim kiem danh sach kho. */
export class WarehouseQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString({ message: 'search phai la chuoi ky tu' })
  search?: string;
}
