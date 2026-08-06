import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';

/** Query tim kiem danh sach khach hang - Wireframe.md muc 12. */
export class CustomerQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString({ message: 'search phai la chuoi ky tu' })
  search?: string;
}
