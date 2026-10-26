import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES, PERMISSIONS, resolveDataScope } from '@app/common-dto';
import { Folder, FolderVisibility } from '../entities/folder.entity';
// 26/10/2026: read-model du an (tai lieu theo pham vi du an) - xem entities/project-ref.entity.ts.
import { ProjectRef } from '../entities/project-ref.entity';

// 28/07/2026: gom ngu canh nguoi goi can de quyet dinh truy cap thu muc/file vao 1 kieu dung
// chung - tranh lap lai 3 tham so rieng le (userId/departmentId/isOrgAdmin) o moi chu ky ham cua
// FoldersService/FilesService.
export interface AccessContext {
  userId: string;
  departmentId: string | null;
  isOrgAdmin: boolean;
  // 26/10/2026: Manager da gan phong ban - xem them tai lieu cua moi du an co thanh vien/nguoi phu
  // trach thuoc phong ban minh (quy tac 4). Optional: thieu = khong mo rong theo phong ban.
  isDepartmentManager?: boolean;
}

/**
 * 26/10/2026: dung AccessContext tu quyen trong JWT - gop 3 ban sao buildAccessContext() cua
 * Folders/Files/Rag controller vao 1 noi. Org Admin = ORG_MANAGE (giu nguyen tu 28/07/2026). Ranh
 * gioi Manager dung chung resolveDataScope() voi cac service khac (@app/common-dto, data-scope.ts),
 * voi quyen cap Manager cua module du an la PROJECT_CREATE - tai lieu o day di theo du an.
 */
export function toAccessContext(userId: string, departmentId: string | null, permissions: string[] | null | undefined): AccessContext {
  const granted = permissions ?? [];
  return {
    userId,
    departmentId,
    isOrgAdmin: granted.includes(PERMISSIONS.ORG_MANAGE),
    isDepartmentManager: resolveDataScope(granted, PERMISSIONS.PROJECT_CREATE, departmentId) !== 'self',
  };
}

export type FolderAccessNode = Pick<Folder, 'id' | 'parentFolderId' | 'visibility' | 'createdByUserId' | 'projectId'>;

/** Ham kiem tra da nap san du lieu (dung lai cho nhieu thu muc/file trong CUNG 1 request). */
export type FolderAccessChecker = (folderId: string) => boolean;

/** 26/10/2026: quyen tuong minh cua nguoi goi, nap bang 1 truy van (xem GRANTS_SQL). */
export interface AccessGrants {
  /** Thu muc co FolderShare cho chinh nguoi goi hoac phong ban cua ho. */
  folderIds: ReadonlySet<string>;
  /** Du an nguoi goi thuoc pham vi: thanh vien/lead, hoac (Manager) du an co nguoi phong ban minh. */
  projectIds: ReadonlySet<string>;
}

/** 26/10/2026: ca 1 lan nap cho 1 request - checker + du an hieu luc cua tung thu muc. */
export interface FolderAccessScope {
  folderIds: string[];
  canAccess: FolderAccessChecker;
  projectIdOf: (folderId: string) => string | null;
  /** 26/10/2026: quyen GHI vao 1 thu muc (xem resolveFolderWrite). */
  writeAccess: (folderId: string) => FolderWriteAccess;
}

// 24/10/2026: tran do sau cay thu muc khi di nguoc len goc - vuot tran = du lieu bat thuong -> tu choi.
export const MAX_FOLDER_DEPTH = 64;

const EMPTY_GRANTS: AccessGrants = { folderIds: new Set(), projectIds: new Set() };

/** Chuoi thu muc tu `folderId` len goc; null neu du lieu bat thuong (khong thay, vong lap, qua sau). */
function folderPath(folderId: string, nodes: ReadonlyMap<string, FolderAccessNode>): FolderAccessNode[] | null {
  const path: FolderAccessNode[] = [];
  const visited = new Set<string>();
  let current = nodes.get(folderId);
  if (!current) return null;
  while (current) {
    if (visited.has(current.id) || visited.size >= MAX_FOLDER_DEPTH) return null;
    visited.add(current.id);
    path.push(current);
    if (!current.parentFolderId) return path;
    current = nodes.get(current.parentFolderId);
  }
  return null;
}

/**
 * 24/10/2026: quy tac truy cap thu muc CO KE THUA tu thu muc cha (ham thuan - unit test doc lap).
 * Technical_Spec: thu muc RESTRICTED an "chinh no VA moi thu ben trong" - truoc day chi xet thu muc
 * truc tiep, nen 1 thu muc con ORGANIZATION (mac dinh) nam trong thu muc RESTRICTED van mo cho ca to
 * chuc (do song: Employee GET duoc file "bang luong thuong" trong thu muc con cua kho mat, va RAG
 * search-chunks tra ve noi dung do ma khong can biet UUID).
 *
 * 26/10/2026: them pham vi du an. Di tu thu muc len goc, tai moi nut N:
 *  1. Co FolderShare tren N -> cho phep (chia se tuong minh mo ca cay con, KE CA khi nguoi goi khong
 *     thuoc du an - giu dung "explicit grant" nhu cu).
 *  2. Nguoi goi tao N -> cho phep, NHUNG chi khi moi du an tu N len goc deu thuoc pham vi cua ho: bi
 *     go khoi du an thi mat ca thu muc minh tung tao trong du an do (khong con "cua rieng" vinh vien).
 *  3. N la RESTRICTED -> tu choi (nhu cu).
 *  4. N gan du an ma nguoi goi khong thuoc pham vi du an do -> tu choi.
 *  5. Con lai -> xet tiep thu muc cha; toi goc khong bi chan -> cho phep (thu muc toan cong ty).
 * Org Admin luon duoc. Du lieu bat thuong (khong thay thu muc/thu muc cha, vong lap, qua sau) -> tu choi.
 */
export function resolveFolderAccess(
  folderId: string,
  nodes: ReadonlyMap<string, FolderAccessNode>,
  grants: AccessGrants,
  ctx: AccessContext,
): boolean {
  if (ctx.isOrgAdmin) return true;
  const path = folderPath(folderId, nodes);
  if (!path) return false;

  const inScope = (node: FolderAccessNode) => !node.projectId || grants.projectIds.has(node.projectId);
  // projectsInScopeFrom[i] = moi du an tu path[i] len goc deu thuoc pham vi nguoi goi.
  const projectsInScopeFrom: boolean[] = new Array(path.length + 1).fill(true);
  for (let i = path.length - 1; i >= 0; i -= 1) projectsInScopeFrom[i] = projectsInScopeFrom[i + 1] && inScope(path[i]);

  for (let i = 0; i < path.length; i += 1) {
    const node = path[i];
    if (grants.folderIds.has(node.id)) return true;
    if (node.createdByUserId === ctx.userId && projectsInScopeFrom[i]) return true;
    if (node.visibility === FolderVisibility.RESTRICTED) return false;
    if (!inScope(node)) return false;
  }
  return true;
}

/** 26/10/2026: du an hieu luc cua 1 thu muc = du an gan gan nhat tren chuoi thu muc cha (null = toan cong ty). */
export function resolveFolderProjectId(folderId: string, nodes: ReadonlyMap<string, FolderAccessNode>): string | null {
  const path = folderPath(folderId, nodes);
  return path?.find((node) => node.projectId)?.projectId ?? null;
}

/**
 * 26/10/2026: quyen GHI (tao thu muc con, tai len, phien ban moi, chia se, doi ten, xoa) vao 1 thu muc:
 *  - Org Admin -> 'allowed'; khong xem duoc thu muc -> 'no-access';
 *  - cay cua 1 du an (co du an tren chuoi thu muc cha) -> 'allowed' (ai xem duoc thi ghi duoc, nhu cu);
 *  - cay toan cong ty (khong du an) -> chi khi co FolderShare tuong minh tren thu muc hoac 1 thu muc cha
 *    (chia se tuong minh van la quyen ghi nhu truoc), con lai 'read-only' - nguoi khac chi XEM.
 * Thu muc goc (`null`) la cay toan cong ty khong the chia se -> chi Org Admin.
 */
export type FolderWriteAccess = 'allowed' | 'no-access' | 'read-only';

export function resolveFolderWrite(
  folderId: string | null,
  nodes: ReadonlyMap<string, FolderAccessNode>,
  grants: AccessGrants,
  ctx: AccessContext,
): FolderWriteAccess {
  if (ctx.isOrgAdmin) return 'allowed';
  if (!folderId) return 'read-only';
  if (!resolveFolderAccess(folderId, nodes, grants, ctx)) return 'no-access';
  const path = folderPath(folderId, nodes) ?? [];
  if (path.some((node) => node.projectId)) return 'allowed';
  return path.some((node) => grants.folderIds.has(node.id)) ? 'allowed' : 'read-only';
}

/**
 * 26/10/2026: 1 truy van cho MOI quyen tuong minh cua nguoi goi - FolderShare (theo user/phong ban,
 * nhu truoc) UNION du an thuoc pham vi (thanh vien/lead; voi Manager ($4 = phong ban) them du an co
 * thanh vien hoac lead thuoc phong ban do). 26/10/2026: "thuoc du an" = lead/thanh vien/NGUOI TAO, "du an
 * lien quan phong ban" = lead/thanh vien/nguoi tao thuoc phong ban - CUNG dinh nghia voi Project-Task Service
 * (ProjectsService.getVisibleProjectIds). Gop 1 cau de createChecker() van chi ton 2 truy van va
 * FilesService.createFileAccessFilter() 3 truy van cho ca request (khong truy van theo tung file).
 */
export const GRANTS_SQL = `
  SELECT 'folder' AS kind, fs.folder_id AS id
    FROM folder_shares fs
   WHERE fs.shared_with_user_id = $2
      OR ($3::uuid IS NOT NULL AND fs.shared_with_department_id = $3::uuid)
  UNION
  SELECT 'project' AS kind, p.project_id AS id
    FROM project_refs p
   WHERE p.organization_id = $1
     AND (p.lead_user_id = $2 OR p.created_by_user_id = $2
          OR EXISTS (SELECT 1 FROM project_member_refs m WHERE m.project_id = p.project_id AND m.user_id = $2)
          OR ($4::uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM user_department_refs d
                 WHERE d.department_id = $4::uuid
                   AND (d.user_id = p.lead_user_id OR d.user_id = p.created_by_user_id
                        OR EXISTS (SELECT 1 FROM project_member_refs m2
                                    WHERE m2.project_id = p.project_id AND m2.user_id = d.user_id)))))`;

/**
 * 28/07/2026: service moi - logic kiem tra quyen truy cap thu muc RESTRICTED, dung CHUNG giua
 * FoldersService va FilesService (ca 2 deu can cung 1 quy tac). Tach rieng thanh 1 provider doc
 * lap (thay vi dat trong FoldersService roi de FilesService goi thang vao) de tranh phu thuoc
 * vong module: FilesModule se import FoldersModule (1 chieu) de dung provider nay, nhung
 * FoldersModule KHONG can biet gi ve FilesModule.
 *
 * 24/10/2026: ke thua quyen tu thu muc cha - xem resolveFolderAccess(). De khong ton N truy van khi
 * kiem tra nhieu thu muc/file (danh sach thu muc, loc ket qua RAG), createChecker() nap 1 LAN toan bo
 * thu muc cua to chuc + quyen cua nguoi goi, sau do moi lan kiem tra chi la duyet bo nho (co memo).
 *
 * 26/10/2026: quyen cua nguoi goi gio gom ca du an thuoc pham vi (GRANTS_SQL) - van 2 truy van.
 */
@Injectable()
export class FolderAccessService {
  constructor(
    @InjectRepository(Folder) private readonly folderRepo: Repository<Folder>,
    // 26/10/2026: chi dung de liet ke du an cua to chuc cho Org Admin (listAccessibleProjectIds).
    @InjectRepository(ProjectRef) private readonly projectRefRepo: Repository<ProjectRef>,
  ) {}

  async loadGrants(organizationId: string, ctx: AccessContext): Promise<AccessGrants> {
    const managerDepartmentId = ctx.isDepartmentManager ? ctx.departmentId : null;
    const rows: { kind: 'folder' | 'project'; id: string }[] = await this.folderRepo.query(GRANTS_SQL, [
      organizationId,
      ctx.userId,
      ctx.departmentId,
      managerDepartmentId,
    ]);
    const folderIds = new Set<string>();
    const projectIds = new Set<string>();
    for (const row of rows) (row.kind === 'folder' ? folderIds : projectIds).add(row.id);
    return { folderIds, projectIds };
  }

  async createScope(organizationId: string, ctx: AccessContext): Promise<FolderAccessScope> {
    const [folders, grants] = await Promise.all([
      this.folderRepo.find({
        select: { id: true, parentFolderId: true, visibility: true, createdByUserId: true, projectId: true },
        where: { organizationId },
      }),
      ctx.isOrgAdmin ? Promise.resolve(EMPTY_GRANTS) : this.loadGrants(organizationId, ctx),
    ]);
    const nodes = new Map<string, FolderAccessNode>(folders.map((folder) => [folder.id, folder]));
    const memo = new Map<string, boolean>();
    return {
      folderIds: folders.map((folder) => folder.id),
      canAccess: (folderId: string) => {
        let allowed = memo.get(folderId);
        if (allowed === undefined) {
          allowed = resolveFolderAccess(folderId, nodes, grants, ctx);
          memo.set(folderId, allowed);
        }
        return allowed;
      },
      projectIdOf: (folderId: string) => resolveFolderProjectId(folderId, nodes),
      writeAccess: (folderId: string) => resolveFolderWrite(folderId, nodes, grants, ctx),
    };
  }

  async createChecker(organizationId: string, ctx: AccessContext): Promise<FolderAccessChecker> {
    if (ctx.isOrgAdmin) return () => true;
    return (await this.createScope(organizationId, ctx)).canAccess;
  }

  /** 26/10/2026: du an nguoi goi duoc gan/xem tai lieu (Org Admin: moi du an cua to chuc). */
  async listAccessibleProjectIds(organizationId: string, ctx: AccessContext): Promise<string[]> {
    if (ctx.isOrgAdmin) {
      const projects = await this.projectRefRepo.find({ select: { projectId: true }, where: { organizationId } });
      return projects.map((project) => project.projectId);
    }
    return [...(await this.loadGrants(organizationId, ctx)).projectIds];
  }

  /**
   * Kiem tra 1 thu muc don le. Duong tat KHONG truy van: Org Admin, hoac thu muc toan cong ty o cap
   * goc (ORGANIZATION, khong gan du an). 26/10/2026: bo duong tat "nguoi tao" - nguoi tao gio cung
   * phai con thuoc pham vi du an (xem resolveFolderAccess, buoc 2). Con lai nap qua createChecker().
   */
  async canAccessFolder(
    folder: Pick<Folder, 'id' | 'organizationId' | 'parentFolderId' | 'visibility' | 'createdByUserId' | 'projectId'>,
    ctx: AccessContext,
  ): Promise<boolean> {
    if (ctx.isOrgAdmin) return true;
    if (!folder.parentFolderId && !folder.projectId && folder.visibility === FolderVisibility.ORGANIZATION) return true;
    const check = await this.createChecker(folder.organizationId, ctx);
    return check(folder.id);
  }

  /** 26/10/2026: quyen GHI vao 1 thu muc (`null` = thu muc goc) - xem resolveFolderWrite(). 2 truy van, Org Admin 0. */
  async writeAccess(organizationId: string, folderId: string | null, ctx: AccessContext): Promise<FolderWriteAccess> {
    if (ctx.isOrgAdmin) return 'allowed';
    if (!folderId) return 'read-only';
    return (await this.createScope(organizationId, ctx)).writeAccess(folderId);
  }

  /** 26/10/2026: nem 403 dung ma loi neu khong ghi duoc - khong xem duoc (FORBIDDEN_FOLDER_ACCESS) hay chi xem (COMPANY_WIDE_READ_ONLY). */
  async assertCanWrite(organizationId: string, folderId: string | null, ctx: AccessContext): Promise<void> {
    const access = await this.writeAccess(organizationId, folderId, ctx);
    if (access === 'no-access') {
      throw new ForbiddenException({ message: 'Ban khong co quyen truy cap thu muc nay', errorCode: ERROR_CODES.FORBIDDEN_FOLDER_ACCESS });
    }
    if (access === 'read-only') {
      throw new ForbiddenException({
        message: 'Tai lieu toan cong ty chi Quan tri vien to chuc moi duoc chinh sua',
        errorCode: ERROR_CODES.COMPANY_WIDE_READ_ONLY,
      });
    }
  }
}
