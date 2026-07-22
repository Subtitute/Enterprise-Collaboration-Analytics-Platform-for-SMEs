import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateTaskDto {
  // 22/07/2026 (fix code review, loi MINOR): thieu @IsNotEmpty() khien PATCH { "title": "" } am
  // tham luu tieu de rong (khac CreateTaskDto.title co ca @IsString + @IsNotEmpty). @IsOptional()
  // van cho phep BO QUA field nay hoan toan (khong gui title trong body PATCH), chi chan truong hop
  // gui title la chuoi rong.
  @IsOptional()
  @IsString({ message: 'Tieu de cong viec phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Tieu de cong viec khong duoc de trong' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Mo ta cong viec phai la chuoi ky tu' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Han hoan thanh phai la ngay hop le (ISO-8601)' })
  dueDate?: string;
}
