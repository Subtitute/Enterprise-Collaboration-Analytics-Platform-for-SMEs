import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissionKeys: string[];
}
