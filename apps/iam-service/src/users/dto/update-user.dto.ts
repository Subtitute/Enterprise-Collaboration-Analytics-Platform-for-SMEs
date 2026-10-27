import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  // 26/10/2026: ho so that (Technical_Spec.md muc 27.6) - null/chuoi rong = xoa gia tri.
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  employeeCode?: string | null;
}
