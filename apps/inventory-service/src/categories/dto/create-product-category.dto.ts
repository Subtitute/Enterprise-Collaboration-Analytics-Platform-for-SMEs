import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Tao danh muc san pham moi - Technical_Spec.md muc 22. */
export class CreateProductCategoryDto {
  @IsString({ message: 'Ten danh muc phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten danh muc khong duoc de trong' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Mo ta phai la chuoi ky tu' })
  description?: string;
}
