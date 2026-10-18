import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Tao kho moi - Technical_Spec.md muc 22. */
export class CreateWarehouseDto {
  @IsString({ message: 'Ten kho phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten kho khong duoc de trong' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Dia chi phai la chuoi ky tu' })
  address?: string;
}
