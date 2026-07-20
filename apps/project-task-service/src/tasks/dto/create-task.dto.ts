import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/** Tao cong viec moi trong 1 du an - Technical_Spec.md muc 3.3. */
export class CreateTaskDto {
  @IsUUID('4', { message: 'projectId phai la UUID hop le' })
  projectId: string;

  @IsString({ message: 'Tieu de cong viec phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Tieu de cong viec khong duoc de trong' })
  title: string;

  @IsOptional()
  @IsString({ message: 'Mo ta cong viec phai la chuoi ky tu' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Han hoan thanh phai la ngay hop le (ISO-8601)' })
  dueDate?: string;
}
