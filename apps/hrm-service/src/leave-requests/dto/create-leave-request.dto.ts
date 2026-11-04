import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LeaveType } from '@app/common-dto';

/** Tao yeu cau nghi phep moi - Technical_Spec.md muc 17. */
export class CreateLeaveRequestDto {
  @IsDateString({}, { message: 'Ngay bat dau phai la ngay hop le (ISO-8601)' })
  startDate: string;

  @IsDateString({}, { message: 'Ngay ket thuc phai la ngay hop le (ISO-8601)' })
  endDate: string;

  @IsString({ message: 'Ly do phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ly do nghi phep khong duoc de trong' })
  reason: string;

  // 04/11/2026: tuy chon de client cu (ung dung di dong) van hop le - thieu thi suy tu tien to `reason`,
  // khong co tien to thi la phep nam (xem inferLeaveTypeFromReason()).
  @IsOptional()
  @IsEnum(LeaveType, { message: 'Loại nghỉ phép không hợp lệ' })
  leaveType?: LeaveType;
}
