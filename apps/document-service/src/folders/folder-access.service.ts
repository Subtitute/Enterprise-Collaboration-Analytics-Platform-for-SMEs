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

export type FolderAccessNode = Pick<Folder, 'id' | 'parentFolderId' | 'visibility' | 'createdByUserId'>;

/** Ham kiem tra da nap san du lieu (dung lai cho nhieu thu muc/file trong CUNG 1 request). */
export type FolderAccessChecker = (folderId: string) => boolean;

// 24/10/2026: tran do sau cay thu muc khi di nguoc len goc - vuot tran = du lieu bat thuong -> tu choi.
export const MAX_FOLDER_DEPTH = 64;

/**
 * 24/10/2026: quy tac truy cap thu muc CO KE THUA tu thu muc cha (ham thuan - unit test doc lap).
 * Technical_Spec: thu muc RESTRICTED an "chinh no VA moi thu ben trong" - truoc day chi xet thu muc
 * truc tiep, nen 1 thu muc con ORGANIZATION (mac dinh) nam trong thu muc RESTRICTED van mo cho ca to
 * chuc (do song: Employee GET duoc file "bang luong thuong" trong thu muc con cua kho mat, va RAG
 * search-chunks tra ve noi dung do ma khong can biet UUID).
 *
 * Quy tac: Org Admin -> cho phep. Di tu thu muc len goc, tai moi nut N: nguoi goi co quyen TUONG MINH
 * tren N (la nguoi tao N, hoac co FolderShare tren N theo user/phong ban) -> cho phep (quyen tuong minh
 * phu ca cay con ben duoi, cung tinh than ngoai le "link truc tiep" cua FileShare); N la RESTRICTED ->
 * tu choi; N la ORGANIZATION -> xet tiep thu muc cha. Toi goc ma khong bi chan -> cho phep. Du lieu bat
 * thuong (khong thay thu muc/thu muc cha, vong lap, qua sau) -> tu choi.
 */
export function resolveFolderAccess(
  folderId: string,
  nodes: ReadonlyMap<string, FolderAccessNode>,
  grantedFolderIds: ReadonlySet<string>,
  ctx: AccessContext,
): boolean {
  if (ctx.isOrgAdmin) return true;
  const visited = new Set<string>();
  let current = nodes.get(folderId);
  while (current) {
    if (visited.has(current.id) || visited.size >= MAX_FOLDER_DEPTH) return false;
    visited.add(current.id);
    if (current.createdByUserId === ctx.userId || grantedFolderIds.has(current.id)) return true;
    if (current.visibility === FolderVisibility.RESTRICTED) return false;
    if (!current.parentFolderId) return true;
    current = nodes.get(current.parentFolderId);
  }
  return false;
}

/**
 * 28/07/2026: service moi - logic kiem tra quyen truy cap thu muc RESTRICTED, dung CHUNG giua
 * FoldersService va FilesService (ca 2 deu can cung 1 quy tac). Tach rieng thanh 1 provider doc
 * lap (thay vi dat trong FoldersService roi de FilesService goi thang vao) de tranh phu thuoc
 * vong module: FilesModule se import FoldersModule (1 chieu) de dung provider nay, nhung
 * FoldersModule KHONG can biet gi ve FilesModule.
 *
 * 24/10/2026: ke thua quyen tu thu muc cha - xem resolveFolderAccess(). De khong ton N truy van khi
 * kiem tra nhieu thu muc/file (danh sach thu muc, loc ket qua RAG), createChecker() nap 1 LAN toan bo
 * thu muc cua to chuc (4 cot) + FolderShare cua nguoi goi (2 truy van), sau do moi lan kiem tra chi
 * la duyet bo nho (co memo).
 */
@Injectable()
export class FolderAccessService {
  constructor(
    @InjectRepository(FolderShare) private readonly folderShareRepo: Repository<FolderShare>,
    @InjectRepository(Folder) private readonly folderRepo: Repository<Folder>,
  ) {}

  async createChecker(organizationId: string, ctx: AccessContext): Promise<FolderAccessChecker> {
    if (ctx.isOrgAdmin) return () => true;

    const shareConditions: FindOptionsWhere<FolderShare>[] = [{ sharedWithUserId: ctx.userId }];
    if (ctx.departmentId) shareConditions.push({ sharedWithDepartmentId: ctx.departmentId });
    const [folders, shares] = await Promise.all([
      this.folderRepo.find({
        select: { id: true, parentFolderId: true, visibility: true, createdByUserId: true },
        where: { organizationId },
      }),
      this.folderShareRepo.find({ select: { folderId: true }, where: shareConditions }),
    ]);
    const nodes = new Map<string, FolderAccessNode>(folders.map((folder) => [folder.id, folder]));
    const granted = new Set(shares.map((share) => share.folderId));

    const memo = new Map<string, boolean>();
    return (folderId: string) => {
      let allowed = memo.get(folderId);
      if (allowed === undefined) {
        allowed = resolveFolderAccess(folderId, nodes, granted, ctx);
        memo.set(folderId, allowed);
      }
      return allowed;
    };
  }

  /**
   * Kiem tra 1 thu muc don le. Duong tat KHONG truy van: Org Admin, nguoi tao chinh thu muc nay, hoac
   * thu muc ORGANIZATION o cap goc. Con lai nap du lieu qua createChecker() (2 truy van).
   */
  async canAccessFolder(
    folder: Pick<Folder, 'id' | 'organizationId' | 'parentFolderId' | 'visibility' | 'createdByUserId'>,
    ctx: AccessContext,
  ): Promise<boolean> {
    if (ctx.isOrgAdmin || folder.createdByUserId === ctx.userId) return true;
    if (!folder.parentFolderId && folder.visibility === FolderVisibility.ORGANIZATION) return true;
    const check = await this.createChecker(folder.organizationId, ctx);
    return check(folder.id);
  }
}
