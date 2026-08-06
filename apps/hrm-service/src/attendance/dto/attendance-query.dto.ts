import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';

/** Query danh sach cham cong toan to chuc (Manager/Org Admin, PERMISSIONS.ATTENDANCE_VIEW). */
export class AttendanceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'userId phai la UUID hop le' })
  userId?: string;
}
