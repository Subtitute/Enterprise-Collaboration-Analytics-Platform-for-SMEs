import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CalendarEventType } from '@app/common-dto';

/** Sua 1 muc lich cong ty - moi field deu tuy chon (PATCH). */
export class UpdateCalendarEventDto {
  @IsOptional()
  @IsString({ message: 'Tieu de phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Tieu de khong duoc de trong' })
  @MaxLength(200, { message: 'Tieu de toi da 200 ky tu' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Mo ta phai la chuoi ky tu' })
  description?: string;

  @IsOptional()
  @IsEnum(CalendarEventType, { message: 'Loai muc lich khong hop le' })
  type?: CalendarEventType;

  @IsOptional()
  @IsDateString({}, { message: 'Ngay bat dau phai la ngay hop le (ISO-8601)' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngay ket thuc phai la ngay hop le (ISO-8601)' })
  endDate?: string;
}
