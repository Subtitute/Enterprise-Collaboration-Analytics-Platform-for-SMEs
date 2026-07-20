import { IsOptional, IsUUID } from 'class-validator';

/** GET /analytics/task-status-breakdown?projectId= (loc theo du an, tuy chon). */
export class TaskStatusBreakdownQueryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
