import { IsEnum, IsUUID } from 'class-validator';
import { FileSharePermission } from '../../entities/file-share.entity';

export class ShareFileDto {
  @IsUUID()
  sharedWithUserId: string;

  @IsEnum(FileSharePermission)
  permission: FileSharePermission;
}
