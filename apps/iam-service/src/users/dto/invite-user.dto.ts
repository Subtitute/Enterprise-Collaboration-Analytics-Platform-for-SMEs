import { IsArray, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * MVP: khong co dich vu gui email that su, Org Admin dat mat khau ban dau truc tiep
 * roi thong bao thu cong cho nhan vien (Technical_Spec.md muc 14 - Gioi han da biet).
 *
 * 26/10/2026: `initialPassword` thanh TUY CHON (Technical_Spec.md muc 27.9, Q7) - de trong thi
 * iam-service dat mat khau ngau nhien (khong ai biet) va gui email kich hoat (token INVITE 72 gio);
 * them `phoneNumber`/`employeeCode` (chi nguoi co user:manage duoc gui, xem UsersService.invite()).
 */
export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  initialPassword?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  employeeCode?: string;
}
