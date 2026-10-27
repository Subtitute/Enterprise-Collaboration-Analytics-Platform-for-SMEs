import { IsOptional, IsString, MaxLength } from 'class-validator';

/** 26/10/2026: PATCH /users/me - chinh chu chi tu sua so dien thoai (Technical_Spec.md muc 27.7). */
export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string | null;
}
