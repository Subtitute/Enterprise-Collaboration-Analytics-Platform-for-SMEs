import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

/** Giai trinh cham cong (giay to xin sua gio vao/ra) - HRM-lite mo rong, bo sung 22/09/2026. */
export class CreateAttendanceAdjustmentDto {
  @IsUUID('4', { message: 'attendanceId phai la UUID hop le' })
  attendanceId: string;

  @IsDateString({}, { message: 'Gio vao de xuat phai la thoi diem hop le (ISO-8601)' })
  proposedCheckInAt: string;

  @IsDateString({}, { message: 'Gio ra de xuat phai la thoi diem hop le (ISO-8601)' })
  proposedCheckOutAt: string;

  @IsString({ message: 'Ly do phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ly do giai trinh khong duoc de trong' })
  reason: string;
}
