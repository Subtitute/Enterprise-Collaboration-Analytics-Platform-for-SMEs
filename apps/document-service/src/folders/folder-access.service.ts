import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Folder, FolderVisibility } from '../entities/folder.entity';
import { FolderShare } from '../entities/folder-share.entity';

// 28/07/2026: gom ngu canh nguoi goi can de quyet dinh truy cap thu muc/file vao 1 kieu dung
// chung - tranh lap lai 3 tham so rieng le (userId/departmentId/isOrgAdmin) o moi chu ky ham cua
// FoldersService/FilesService.
export interface AccessContext {
  userId: string;
  departmentId: string | null;
  isOrgAdmin: boolean;
}

/**
 * 28/07/2026: service moi - logic kiem tra quyen truy cap thu muc RESTRICTED, dung CHUNG giua
 * FoldersService va FilesService (ca 2 deu can cung 1 quy tac). Tach rieng thanh 1 provider doc
 * lap (thay vi dat trong FoldersService roi de FilesService goi thang vao) de tranh phu thuoc
 * vong module: FilesModule se import FoldersModule (1 chieu) de dung provider nay, nhung
 * FoldersModule KHONG can biet gi ve FilesModule.
 */
@Injectable()
export class FolderAccessService {
  constructor(@InjectRepository(FolderShare) private readonly folderShareRepo: Repository<FolderShare>) {}

  /**
   * true khi: (a) thu muc dang o che do mac dinh ORGANIZATION (opt-in - xem FolderVisibility),
   * (b) nguoi goi chinh la nguoi tao thu muc, (c) nguoi goi la Org Admin (PERMISSIONS.ORG_MANAGE -
   * luon thay duoc moi thu bat ke thu muc co han che hay khong), hoac (d) ton tai 1 dong
   * FolderShare khop voi userId HOAC (neu co) departmentId cua nguoi goi. Nguoc lai (thu muc
   * RESTRICTED va khong khop dieu kien nao o tren) tra ve false.
   */
  async canAccessFolder(
    folder: Pick<Folder, 'id' | 'visibility' | 'createdByUserId'>,
    ctx: AccessContext,
  ): Promise<boolean> {
    if (folder.visibility === FolderVisibility.ORGANIZATION) return true;
    if (folder.createdByUserId === ctx.userId) return true;
    if (ctx.isOrgAdmin) return true;

    const conditions: FindOptionsWhere<FolderShare>[] = [{ folderId: folder.id, sharedWithUserId: ctx.userId }];
    if (ctx.departmentId) {
      conditions.push({ folderId: folder.id, sharedWithDepartmentId: ctx.departmentId });
    }
    const share = await this.folderShareRepo.findOne({ where: conditions });
    return !!share;
  }
}
