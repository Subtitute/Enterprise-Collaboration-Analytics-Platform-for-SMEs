import { IsArray, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * MVP: khong co dich vu gui email that su, Org Admin dat mat khau ban dau truc tiep
 * roi thong bao thu cong cho nhan vien (Technical_Spec.md muc 14 - Gioi han da biet).
 */
export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsString()
  fullName: string;

  @IsString()
  @MinLength(8)
  initialPassword: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
