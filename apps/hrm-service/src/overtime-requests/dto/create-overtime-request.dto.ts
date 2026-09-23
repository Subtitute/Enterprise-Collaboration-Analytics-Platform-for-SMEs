import { IsDateString, IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { OvertimeMultiplierType } from '../../entities/overtime-request.entity';

const TIME_HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Dang ky tang ca (OT) - HRM-lite mo rong, bo sung 22/09/2026. */
export class CreateOvertimeRequestDto {
  @IsDateString({}, { message: 'Ngay lam viec phai la ngay hop le (ISO-8601)' })
  workDate: string;

  @Matches(TIME_HH_MM_REGEX, { message: 'Gio bat dau OT phai co dang HH:mm' })
  otStart: string;

  @Matches(TIME_HH_MM_REGEX, { message: 'Gio ket thuc OT phai co dang HH:mm' })
  otEnd: string;

  @IsEnum(OvertimeMultiplierType, { message: 'Loai he so tang ca khong hop le' })
  multiplierType: OvertimeMultiplierType;

  @IsString({ message: 'Ly do phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ly do tang ca khong duoc de trong' })
  reason: string;
}
