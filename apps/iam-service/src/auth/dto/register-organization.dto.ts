import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/** Dang ky to chuc moi - Wireframe.md muc 1 (Dang ky to chuc moi, 3 buoc). */
export class RegisterOrganizationDto {
  @IsString()
  @IsNotEmpty()
  organizationName: string;

  @IsOptional()
  @IsString()
  taxCode?: string;

  @IsString()
  @IsNotEmpty()
  adminFullName: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(8)
  adminPassword: string;
}
