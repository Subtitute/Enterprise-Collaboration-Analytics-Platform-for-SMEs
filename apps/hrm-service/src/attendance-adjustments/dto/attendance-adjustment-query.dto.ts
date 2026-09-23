import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';
import { AttendanceAdjustmentStatus } from '../../entities/attendance-adjustment.entity';

/** Query danh sach giai trinh cham cong toan to chuc (Manager/Org Admin, PERMISSIONS.ATTENDANCE_ADJUSTMENT_VIEW). */
export class AttendanceAdjustmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'userId phai la UUID hop le' })
  userId?: string;

  @IsOptional()
  @IsEnum(AttendanceAdjustmentStatus, { message: 'Trang thai khong hop le' })
  status?: AttendanceAdjustmentStatus;
}
