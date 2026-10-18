import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/** Tao san pham moi trong danh muc - Technical_Spec.md muc 22. */
export class CreateProductDto {
  @IsUUID('4', { message: 'categoryId phai la UUID hop le' })
  categoryId: string;

  @IsString({ message: 'Ten san pham phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten san pham khong duoc de trong' })
  name: string;

  @IsString({ message: 'SKU phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'SKU khong duoc de trong' })
  sku: string;

  @IsOptional()
  @IsString({ message: 'Mo ta phai la chuoi ky tu' })
  description?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Don gia phai la so' })
  @Min(0, { message: 'Don gia khong duoc am' })
  unitPrice?: number;
}
