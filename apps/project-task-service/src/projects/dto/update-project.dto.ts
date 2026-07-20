import { IsOptional, IsString } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString({ message: 'Ten du an phai la chuoi ky tu' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Mo ta du an phai la chuoi ky tu' })
  description?: string;
}
