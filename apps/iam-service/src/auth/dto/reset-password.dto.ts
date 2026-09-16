import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/** Dat mat khau moi bang token nhan qua email - Technical_Spec.md "Quen mat khau". */
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  // Mirror dung rang buoc RegisterOrganizationDto.adminPassword (chi @MinLength(8), khong yeu cau
  // ky tu dac biet/hoa-thuong - giu nhat quan 1 quy tac mat khau DUY NHAT trong toan he thong).
  @IsString()
  @MinLength(8)
  newPassword: string;
}
