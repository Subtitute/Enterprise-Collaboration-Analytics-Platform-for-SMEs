import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Sua danh muc san pham - moi truong deu tuy chon (chi sua truong duoc gui). */
export class UpdateProductCategoryDto {
  @IsOptional()
  @IsString({ message: 'Ten danh muc phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten danh muc khong duoc de trong' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Mo ta phai la chuoi ky tu' })
  description?: string;
}
