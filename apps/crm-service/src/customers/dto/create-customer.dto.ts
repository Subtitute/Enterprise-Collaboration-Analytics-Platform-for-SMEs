import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Tao khach hang moi - Technical_Spec.md muc 16, Wireframe.md muc 12. */
export class CreateCustomerDto {
  @IsString({ message: 'Ten khach hang phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten khach hang khong duoc de trong' })
  name: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email khong hop le' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'So dien thoai phai la chuoi ky tu' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Cong ty phai la chuoi ky tu' })
  company?: string;

  @IsOptional()
  @IsString({ message: 'Ghi chu phai la chuoi ky tu' })
  notes?: string;
}
