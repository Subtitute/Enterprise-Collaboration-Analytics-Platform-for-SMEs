import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { LeaveRequestStatus, PaginationQueryDto } from '@app/common-dto';

/** Query danh sach nghi phep toan to chuc (Manager/Org Admin, PERMISSIONS.LEAVE_REQUEST_VIEW). */
export class LeaveRequestQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'userId phai la UUID hop le' })
  userId?: string;

  @IsOptional()
  @IsEnum(LeaveRequestStatus, { message: 'Trang thai nghi phep khong hop le' })
  status?: LeaveRequestStatus;
}
