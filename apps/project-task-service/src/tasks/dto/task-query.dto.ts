import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto, TaskStatus } from '@app/common-dto';

/** Query loc danh sach Task theo du an/trang thai - dung cho Kanban board (Wireframe.md muc 4). */
export class TaskQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'projectId phai la UUID hop le' })
  projectId?: string;

  @IsOptional()
  @IsEnum(TaskStatus, { message: 'Trang thai cong viec khong hop le' })
  status?: TaskStatus;
}
