import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Sua kho - moi truong deu tuy chon (chi sua truong duoc gui). */
export class UpdateWarehouseDto {
  @IsOptional()
  @IsString({ message: 'Ten kho phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten kho khong duoc de trong' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Dia chi phai la chuoi ky tu' })
  address?: string;
}
