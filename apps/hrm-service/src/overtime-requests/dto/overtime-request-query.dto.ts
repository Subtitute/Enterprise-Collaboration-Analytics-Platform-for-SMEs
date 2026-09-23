import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';
import { OvertimeRequestStatus } from '../../entities/overtime-request.entity';

/** Query danh sach dang ky tang ca toan to chuc (Manager/Org Admin, PERMISSIONS.OVERTIME_REQUEST_VIEW). */
export class OvertimeRequestQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'userId phai la UUID hop le' })
  userId?: string;

  @IsOptional()
  @IsEnum(OvertimeRequestStatus, { message: 'Trang thai khong hop le' })
  status?: OvertimeRequestStatus;

  // 22/09/2026: loc theo thang 'YYYY-MM' (prefix khop workDate) - MonthlyTimesheetTable.tsx (frontend)
  // dung field nay de lay gio OT DA DUYET trong 1 thang cu the, thay the heuristic doan "checkout
  // sau 17:30" bang du lieu OT that.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month phai co dang YYYY-MM' })
  month?: string;
}
