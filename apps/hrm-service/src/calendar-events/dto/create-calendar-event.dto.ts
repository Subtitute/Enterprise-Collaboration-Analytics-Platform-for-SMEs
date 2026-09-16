import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CalendarEventType } from '@app/common-dto';

/** Tao muc lich cong ty moi (ngay le hoac su kien) - Technical_Spec.md "Lich cong ty". */
export class CreateCalendarEventDto {
  @IsString({ message: 'Tieu de phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Tieu de khong duoc de trong' })
  @MaxLength(200, { message: 'Tieu de toi da 200 ky tu' })
  title: string;

  @IsOptional()
  @IsString({ message: 'Mo ta phai la chuoi ky tu' })
  description?: string;

  @IsEnum(CalendarEventType, { message: 'Loai muc lich khong hop le' })
  type: CalendarEventType;

  @IsDateString({}, { message: 'Ngay bat dau phai la ngay hop le (ISO-8601)' })
  startDate: string;

  // 15/09/2026: endDate TUY CHON - de trong = muc lich 1 ngay (endDate = startDate), xem
  // CalendarEventsService.create(). Da co @IsOptional() nen khong bat buoc client phai tu dien lai
  // startDate cho truong hop pho bien nhat (1 ngay le/su kien don).
  @IsOptional()
  @IsDateString({}, { message: 'Ngay ket thuc phai la ngay hop le (ISO-8601)' })
  endDate?: string;
}
