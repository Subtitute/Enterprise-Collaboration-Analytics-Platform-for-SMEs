import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateDealDto {
  @IsOptional()
  @IsString({ message: 'Tieu de deal phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Tieu de deal khong duoc de trong' })
  title?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Gia tri deal phai la so' })
  @Min(0, { message: 'Gia tri deal khong duoc am' })
  value?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Ngay du kien chot phai la ngay hop le (ISO-8601)' })
  expectedCloseDate?: string;
}
