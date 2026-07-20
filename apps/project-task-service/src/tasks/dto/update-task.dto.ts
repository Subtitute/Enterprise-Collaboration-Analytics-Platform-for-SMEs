import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString({ message: 'Tieu de cong viec phai la chuoi ky tu' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Mo ta cong viec phai la chuoi ky tu' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Han hoan thanh phai la ngay hop le (ISO-8601)' })
  dueDate?: string;
}
