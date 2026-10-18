import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/** Sua san pham - moi truong deu tuy chon (chi sua truong duoc gui). */
export class UpdateProductDto {
  @IsOptional()
  @IsUUID('4', { message: 'categoryId phai la UUID hop le' })
  categoryId?: string;

  @IsOptional()
  @IsString({ message: 'Ten san pham phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten san pham khong duoc de trong' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'SKU phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'SKU khong duoc de trong' })
  sku?: string;

  @IsOptional()
  @IsString({ message: 'Mo ta phai la chuoi ky tu' })
  description?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Don gia phai la so' })
  @Min(0, { message: 'Don gia khong duoc am' })
  unitPrice?: number;
}
