import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ProjectStatus } from '@ecap/common-dto';

export class UpdateProjectDto {
  @IsOptional()
  @IsString({ message: 'Ten du an phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten du an khong duoc de trong' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Mo ta du an phai la chuoi ky tu' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Han hoan thanh du an phai la ngay hop le (ISO-8601)' })
  dueDate?: string;

  @IsOptional()
  @IsEnum(ProjectStatus, { message: 'Trang thai du an khong hop le' })
  status?: ProjectStatus;
}
