import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsUUID()
  parentFolderId?: string;

  // 26/10/2026: du an cua thu muc CAP GOC (tai lieu theo pham vi du an). Bo trong = thu muc toan
  // cong ty - chi Org Admin; thu muc con khong nhan truong nay (ke thua thu muc cha). Kiem tra o
  // FoldersService.create().
  @IsOptional()
  @IsUUID('4', { message: 'projectId phai la UUID hop le' })
  projectId?: string;
}
