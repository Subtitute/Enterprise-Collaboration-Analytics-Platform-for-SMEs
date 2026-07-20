import { IsEnum } from 'class-validator';
import { TaskStatus } from '@app/common-dto';

/** Body cho PATCH /tasks/:id/status - endpoint keo-tha Kanban board (Wireframe.md muc 4.2). */
export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus, { message: 'Trang thai cong viec khong hop le (TODO | DOING | DONE)' })
  status: TaskStatus;
}
