import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

/** Tao yeu cau nghi phep moi - Technical_Spec.md muc 17. */
export class CreateLeaveRequestDto {
  @IsDateString({}, { message: 'Ngay bat dau phai la ngay hop le (ISO-8601)' })
  startDate: string;

  @IsDateString({}, { message: 'Ngay ket thuc phai la ngay hop le (ISO-8601)' })
  endDate: string;

  @IsString({ message: 'Ly do phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ly do nghi phep khong duoc de trong' })
  reason: string;
}
