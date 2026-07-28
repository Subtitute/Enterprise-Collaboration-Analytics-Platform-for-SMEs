import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { FileSharePermission } from '../../entities/file-share.entity';

// 28/07/2026: `sharedWithUserId` chuyen thanh optional, bo sung `sharedWithDepartmentId` optional
// (chia se file theo PHONG BAN) - CHINH XAC 1 trong 2 truong phai duoc cung cap, kiem tra o
// FilesService.share() (HINH DANG du lieu validate o day, RANG BUOC nghiep vu "chinh xac 1"
// validate o service, giong huong tiep can cua CreateFolderShareDto).
export class ShareFileDto {
  @IsOptional()
  @IsUUID()
  sharedWithUserId?: string;

  @IsOptional()
  @IsUUID()
  sharedWithDepartmentId?: string;

  @IsEnum(FileSharePermission)
  permission: FileSharePermission;
}
