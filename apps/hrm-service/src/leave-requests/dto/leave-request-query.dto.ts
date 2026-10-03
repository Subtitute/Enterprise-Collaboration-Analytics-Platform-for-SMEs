import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { LeaveRequestStatus, PaginationQueryDto } from '@app/common-dto';

/**
 * Query danh sach nghi phep toan to chuc (Manager/Org Admin, PERMISSIONS.LEAVE_REQUEST_VIEW).
 *
 * 03/10/2026: day CUNG LA cach "xem lich su nghi phep day du cua 1 nhan vien cu the" - truyen
 * userId MA KHONG truyen status se tra ve CA 3 trang thai (PENDING/APPROVED/REJECTED) cua rieng
 * nhan vien do, phan trang nhu moi danh sach khac (xem LeaveRequestsService.findAll()). Khong tach
 * route rieng - mirror dung pattern AttendanceQueryDto.userId/AttendanceService.findAll() (cung
 * module HRM-lite) vi da co san CA 2 (route GET /leave-requests + field userId) tu truoc, chi thieu
 * phan test xac nhan hanh vi.
 */
export class LeaveRequestQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'userId phai la UUID hop le' })
  userId?: string;

  @IsOptional()
  @IsEnum(LeaveRequestStatus, { message: 'Trang thai nghi phep khong hop le' })
  status?: LeaveRequestStatus;
}
