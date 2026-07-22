import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateProjectDto {
  // 22/07/2026 (fix code review, loi MINOR): thieu @IsNotEmpty() khien PATCH { "name": "" } am tham
  // luu ten du an rong (khac CreateProjectDto.name co ca @IsString + @IsNotEmpty). @IsOptional() van
  // cho phep BO QUA field nay hoan toan, chi chan truong hop gui name la chuoi rong.
  @IsOptional()
  @IsString({ message: 'Ten du an phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten du an khong duoc de trong' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Mo ta du an phai la chuoi ky tu' })
  description?: string;

  // 22/07/2026 (fix code review, loi MINOR - Fix 8): bo sung dueDate cho UpdateProjectDto, cung dot
  // voi CreateProjectDto - xem project.entity.ts (cot moi `due_date`) va ProjectsService.update().
  @IsOptional()
  @IsDateString({}, { message: 'Han hoan thanh du an phai la ngay hop le (ISO-8601)' })
  dueDate?: string;
}
