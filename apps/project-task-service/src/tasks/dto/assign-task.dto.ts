import { IsUUID } from 'class-validator';

export class AssignTaskDto {
  @IsUUID('4', { message: 'userId phai la UUID hop le' })
  userId: string;
}
