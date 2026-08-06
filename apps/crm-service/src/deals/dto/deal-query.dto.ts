import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DealStage, PaginationQueryDto } from '@app/common-dto';

/** Query loc danh sach Deal theo khach hang/giai doan - dung cho Kanban pipeline ban hang. */
export class DealQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'customerId phai la UUID hop le' })
  customerId?: string;

  @IsOptional()
  @IsEnum(DealStage, { message: 'Giai doan deal khong hop le' })
  stage?: DealStage;
}
