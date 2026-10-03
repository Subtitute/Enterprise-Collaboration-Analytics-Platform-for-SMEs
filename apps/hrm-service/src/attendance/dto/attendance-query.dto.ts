import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';

/** Query danh sach cham cong toan to chuc (Manager/Org Admin, PERMISSIONS.ATTENDANCE_VIEW). */
export class AttendanceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'userId phai la UUID hop le' })
  userId?: string;

  // 03/10/2026: bo sung loc theo khoang ngay (vd 1 thang tren bo loc "Chấm công toàn tổ chức",
  // AttendancePage.tsx) - phat hien qua rieng soat: truoc day KHONG co tham so nay, frontend phai
  // tu loc client-side tren toi da 100 dong tra ve (limit cung), khien chon 1 thang CU co the hien
  // "khong co du lieu" sai su that mot khi to chuc vuot qua 100 dong cham cong tong (dong thang do
  // bi dong moi hon "day" ra khoi 100 dong dau). Mirror dung quy uoc overlap-filter cua
  // CalendarEventQueryDto (startDate/endDate).
  @IsOptional()
  @IsDateString({}, { message: 'startDate phai la ngay hop le (YYYY-MM-DD)' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate phai la ngay hop le (YYYY-MM-DD)' })
  endDate?: string;
}
