import { IsOptional, IsUUID } from 'class-validator';

// 28/07/2026: file moi - body cho `POST /folders/:id/shares` (kiem soat truy cap thu muc theo
// pham vi to chuc, opt-in). CHINH XAC 1 trong 2 truong phai duoc cung cap - kiem tra o tang
// service (FoldersService.createShare), khong dung custom validator o day, giu dong nhat voi cach
// ShareFileDto/FilesService.share() xu ly cung 1 rang buoc "CHINH XAC 1 trong 2".
export class CreateFolderShareDto {
  @IsOptional()
  @IsUUID()
  sharedWithUserId?: string;

  @IsOptional()
  @IsUUID()
  sharedWithDepartmentId?: string;
}
