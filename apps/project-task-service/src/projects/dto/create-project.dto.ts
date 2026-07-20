import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Tao du an moi - Technical_Spec.md muc 3.3, Wireframe.md muc 4. */
export class CreateProjectDto {
  @IsString({ message: 'Ten du an phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten du an khong duoc de trong' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Mo ta du an phai la chuoi ky tu' })
  description?: string;
}
