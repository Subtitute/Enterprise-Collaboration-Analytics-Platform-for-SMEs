import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * 26/10/2026: PATCH /users/me/password - thay nut "Cap nhat mat khau" gia lap tren Ho so ca nhan.
 * Cung quy tac do manh voi dat lai/moi thanh vien (toi thieu 8 ky tu, ResetPasswordDto/InviteUserDto).
 */
export class ChangeMyPasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
