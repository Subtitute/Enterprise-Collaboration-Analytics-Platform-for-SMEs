// 28/07/2026: file moi - unit test cho FolderAccessService.canAccessFolder (kiem soat truy cap
// thu muc, opt-in).
// 24/10/2026: viet lai theo quy tac KE THUA tu thu muc cha (resolveFolderAccess) - giu cac duong cu
// (ORGANIZATION / nguoi tao / Org Admin / FolderShare theo user hoac phong ban / tu choi) va bo sung
// thu muc long nhau, quyen tuong minh phu cay con, vong lap du lieu, so truy van.
// 26/10/2026: them pham vi du an (thanh vien/lead, Manager theo phong ban, nguoi tao mat quyen khi
// roi du an, chia se tuong minh van mo cay con) - quyen tuong minh gio la AccessGrants.
import { PERMISSIONS } from '@app/common-dto';
import {
  AccessContext,
  AccessGrants,
  FolderAccessNode,
  FolderAccessService,
  GRANTS_SQL,
  MAX_FOLDER_DEPTH,
  resolveFolderAccess,
  resolveFolderProjectId,
  resolveFolderWrite,
  toAccessContext,
} from './folder-access.service';
import { Folder, FolderVisibility } from '../entities/folder.entity';

const { ORGANIZATION, RESTRICTED } = FolderVisibility;
const EMPLOYEE: AccessContext = { userId: 'emp-1', departmentId: 'dept-1', isOrgAdmin: false };

function node(
  id: string,
  visibility: FolderVisibility,
  parentFolderId: string | null = null,
  createdByUserId = 'owner-1',
  projectId: string | null = null,
): FolderAccessNode {
  return { id, visibility, parentFolderId, createdByUserId, projectId };
}
const tree = (...nodes: FolderAccessNode[]) => new Map(nodes.map((n) => [n.id, n]));
const grants = (folderIds: string[] = [], projectIds: string[] = []): AccessGrants => ({
  folderIds: new Set(folderIds),
  projectIds: new Set(projectIds),
});
const NONE = grants();

describe('resolveFolderAccess (quy tac ke thua)', () => {
  it('thu muc ORGANIZATION cap goc -> ai cung xem duoc; RESTRICTED khong quyen -> tu choi', () => {
    const nodes = tree(node('org', ORGANIZATION), node('secret', RESTRICTED));
    expect(resolveFolderAccess('org', nodes, NONE, EMPLOYEE)).toBe(true);
    expect(resolveFolderAccess('secret', nodes, NONE, EMPLOYEE)).toBe(false);
  });

  it('thu muc cha RESTRICTED + thu muc con ORGANIZATION -> con cung bi tu choi (lo hong cu)', () => {
    const nodes = tree(node('secret', RESTRICTED), node('child', ORGANIZATION, 'secret'));
    expect(resolveFolderAccess('child', nodes, NONE, EMPLOYEE)).toBe(false);
  });

  it('FolderShare CHI tren thu muc con -> xem duoc con, khong xem duoc cha', () => {
    const nodes = tree(node('secret', RESTRICTED), node('child', ORGANIZATION, 'secret'));
    expect(resolveFolderAccess('child', nodes, grants(['child']), EMPLOYEE)).toBe(true);
    expect(resolveFolderAccess('secret', nodes, grants(['child']), EMPLOYEE)).toBe(false);
  });

  it('FolderShare tren thu muc cha -> phu thu muc con ORGANIZATION; con RESTRICTED rieng (khong share) van chan', () => {
    const nodes = tree(node('secret', RESTRICTED), node('child', ORGANIZATION, 'secret'), node('inner', RESTRICTED, 'secret'));
    expect(resolveFolderAccess('child', nodes, grants(['secret']), EMPLOYEE)).toBe(true);
    expect(resolveFolderAccess('inner', nodes, grants(['secret']), EMPLOYEE)).toBe(false);
  });

  it('nguoi tao thu muc con ben trong thu muc cha RESTRICTED -> xem duoc thu muc cua minh', () => {
    const nodes = tree(node('secret', RESTRICTED), node('mine', ORGANIZATION, 'secret', 'emp-1'));
    expect(resolveFolderAccess('mine', nodes, NONE, EMPLOYEE)).toBe(true);
    expect(resolveFolderAccess('secret', nodes, NONE, EMPLOYEE)).toBe(false);
  });

  it('3 cap: goc RESTRICTED > ORGANIZATION > ORGANIZATION -> chau bi tu choi; share o goc -> chau xem duoc', () => {
    const nodes = tree(node('a', RESTRICTED), node('b', ORGANIZATION, 'a'), node('c', ORGANIZATION, 'b'));
    expect(resolveFolderAccess('c', nodes, NONE, EMPLOYEE)).toBe(false);
    expect(resolveFolderAccess('c', nodes, grants(['a']), EMPLOYEE)).toBe(true);
    const open = tree(node('a', ORGANIZATION), node('b', ORGANIZATION, 'a'), node('c', ORGANIZATION, 'b'));
    expect(resolveFolderAccess('c', open, NONE, EMPLOYEE)).toBe(true);
  });

  it('du lieu bat thuong -> tu choi: vong lap cha-con, thu muc cha khong ton tai, thu muc khong ton tai, qua sau', () => {
    const cycle = tree(node('x', ORGANIZATION, 'y'), node('y', ORGANIZATION, 'x'));
    expect(resolveFolderAccess('x', cycle, NONE, EMPLOYEE)).toBe(false);
    expect(resolveFolderAccess('orphan', tree(node('orphan', ORGANIZATION, 'missing')), NONE, EMPLOYEE)).toBe(false);
    expect(resolveFolderAccess('missing', tree(), NONE, EMPLOYEE)).toBe(false);

    const deep = Array.from({ length: MAX_FOLDER_DEPTH + 1 }, (_, i) => node(`d${i}`, ORGANIZATION, i === 0 ? null : `d${i - 1}`));
    expect(resolveFolderAccess(`d${MAX_FOLDER_DEPTH}`, tree(...deep), NONE, EMPLOYEE)).toBe(false);
  });

  it('Org Admin -> luon cho phep (ke ca du lieu bat thuong)', () => {
    const nodes = tree(node('secret', RESTRICTED), node('child', ORGANIZATION, 'secret'));
    expect(resolveFolderAccess('child', nodes, NONE, { ...EMPLOYEE, isOrgAdmin: true })).toBe(true);
  });
});

describe('resolveFolderAccess (pham vi du an - 26/10/2026)', () => {
  const nodes = tree(
    node('p1-root', ORGANIZATION, null, 'admin', 'project-1'),
    node('p1-sub', ORGANIZATION, 'p1-root', 'other'),
    node('p1-mine', ORGANIZATION, 'p1-root', 'emp-1'),
    node('p1-secret', RESTRICTED, 'p1-root', 'other'),
    node('p2-root', ORGANIZATION, null, 'admin', 'project-2'),
    node('p2-sub', ORGANIZATION, 'p2-root', 'other'),
    node('policy', ORGANIZATION, null, 'admin'),
  );

  it('thanh vien du an -> xem duoc thu muc du an va thu muc con (ke thua); khong xem duoc du an khac', () => {
    const g = grants([], ['project-1']);
    expect(resolveFolderAccess('p1-root', nodes, g, EMPLOYEE)).toBe(true);
    expect(resolveFolderAccess('p1-sub', nodes, g, EMPLOYEE)).toBe(true);
    expect(resolveFolderAccess('p2-root', nodes, g, EMPLOYEE)).toBe(false);
    expect(resolveFolderAccess('p2-sub', nodes, g, EMPLOYEE)).toBe(false);
  });

  it('thu muc toan cong ty (khong du an, ORGANIZATION) -> ai cung xem duoc', () => {
    expect(resolveFolderAccess('policy', nodes, NONE, EMPLOYEE)).toBe(true);
  });

  it('RESTRICTED trong du an van chan thanh vien neu khong duoc chia se', () => {
    expect(resolveFolderAccess('p1-secret', nodes, grants([], ['project-1']), EMPLOYEE)).toBe(false);
    expect(resolveFolderAccess('p1-secret', nodes, grants(['p1-secret'], ['project-1']), EMPLOYEE)).toBe(true);
  });

  it('chia se tuong minh mo ca cay con du nguoi goi khong thuoc du an', () => {
    expect(resolveFolderAccess('p2-sub', nodes, grants(['p2-root']), EMPLOYEE)).toBe(true);
    expect(resolveFolderAccess('p2-sub', nodes, grants(['p2-sub']), EMPLOYEE)).toBe(true);
  });

  it('nguoi tao thu muc trong du an mat quyen khi khong con thuoc du an', () => {
    expect(resolveFolderAccess('p1-mine', nodes, grants([], ['project-1']), EMPLOYEE)).toBe(true);
    expect(resolveFolderAccess('p1-mine', nodes, NONE, EMPLOYEE)).toBe(false);
    // ...nhung van giu quyen neu thu muc cha cua du an duoc chia se tuong minh cho ho.
    expect(resolveFolderAccess('p1-mine', nodes, grants(['p1-root']), EMPLOYEE)).toBe(true);
  });

  it('resolveFolderProjectId: du an gan nhat tren chuoi thu muc cha, null = toan cong ty', () => {
    expect(resolveFolderProjectId('p1-sub', nodes)).toBe('project-1');
    expect(resolveFolderProjectId('p2-root', nodes)).toBe('project-2');
    expect(resolveFolderProjectId('policy', nodes)).toBeNull();
    expect(resolveFolderProjectId('missing', nodes)).toBeNull();
  });
});

// 26/10/2026: cay toan cong ty (khong du an) chi Org Admin GHI; nguoi khac chi xem, tru khi co FolderShare
// tuong minh tren thu muc/thu muc cha. Cay du an: ai xem duoc thi ghi duoc (nhu cu).
describe('resolveFolderWrite (quyen ghi - 26/10/2026)', () => {
  const nodes = tree(
    node('cw', ORGANIZATION, null, 'admin-1'),
    node('cw-child', ORGANIZATION, 'cw', 'emp-1'),
    node('prj', ORGANIZATION, null, 'owner-1', 'project-1'),
    node('prj-child', ORGANIZATION, 'prj'),
    node('secret', RESTRICTED, null, 'admin-1'),
  );
  it('thu muc goc va cay toan cong ty -> chi xem (ke ca thu muc con do chinh minh tao); Org Admin -> ghi duoc', () => {
    expect(resolveFolderWrite(null, nodes, NONE, EMPLOYEE)).toBe('read-only');
    expect(resolveFolderWrite('cw', nodes, NONE, EMPLOYEE)).toBe('read-only');
    expect(resolveFolderWrite('cw-child', nodes, NONE, EMPLOYEE)).toBe('read-only');
    expect(resolveFolderWrite(null, nodes, NONE, { ...EMPLOYEE, isOrgAdmin: true })).toBe('allowed');
    expect(resolveFolderWrite('cw-child', nodes, NONE, { ...EMPLOYEE, isOrgAdmin: true })).toBe('allowed');
  });
  it('FolderShare tren thu muc toan cong ty (hoac thu muc cha) -> ghi duoc ca cay con', () => {
    expect(resolveFolderWrite('cw', nodes, grants(['cw']), EMPLOYEE)).toBe('allowed');
    expect(resolveFolderWrite('cw-child', nodes, grants(['cw']), EMPLOYEE)).toBe('allowed');
  });
  it('cay du an: thanh vien ghi duoc ca thu muc con; khong thuoc du an / RESTRICTED khong quyen -> no-access', () => {
    expect(resolveFolderWrite('prj-child', nodes, grants([], ['project-1']), EMPLOYEE)).toBe('allowed');
    expect(resolveFolderWrite('prj-child', nodes, NONE, EMPLOYEE)).toBe('no-access');
    expect(resolveFolderWrite('secret', nodes, NONE, EMPLOYEE)).toBe('no-access');
  });
});

describe('toAccessContext', () => {
  it('Org Admin = ORG_MANAGE; Manager theo phong ban = PROJECT_CREATE + co phong ban; Employee = khong', () => {
    const admin = toAccessContext('u', null, [PERMISSIONS.ORG_MANAGE, PERMISSIONS.USER_MANAGE, PERMISSIONS.PROJECT_CREATE]);
    expect(admin.isOrgAdmin).toBe(true);
    expect(toAccessContext('u', 'dept-1', [PERMISSIONS.PROJECT_CREATE])).toEqual({
      userId: 'u',
      departmentId: 'dept-1',
      isOrgAdmin: false,
      isDepartmentManager: true,
    });
    expect(toAccessContext('u', null, [PERMISSIONS.PROJECT_CREATE]).isDepartmentManager).toBe(false);
    expect(toAccessContext('u', 'dept-1', [PERMISSIONS.DOCUMENT_VIEW]).isDepartmentManager).toBe(false);
    expect(toAccessContext('u', 'dept-1', undefined).isOrgAdmin).toBe(false);
  });
});

describe('FolderAccessService', () => {
  function buildService(
    folders: FolderAccessNode[],
    grantRows: { kind: 'folder' | 'project'; id: string }[] = [],
    projectRefs: { projectId: string }[] = [],
  ) {
    const folderRepo = { find: jest.fn().mockResolvedValue(folders), query: jest.fn().mockResolvedValue(grantRows) };
    const projectRefRepo = { find: jest.fn().mockResolvedValue(projectRefs) };
    const service = new FolderAccessService(folderRepo as never, projectRefRepo as never);
    return { service, folderRepo, projectRefRepo };
  }
  const asFolder = (n: FolderAccessNode) => ({ ...n, organizationId: 'org-1' }) as Folder;

  it('createChecker: 2 truy van cho CA request (thu muc cua to chuc + 1 cau quyen tuong minh gom FolderShare va du an)', async () => {
    const { service, folderRepo } = buildService(
      [node('a', RESTRICTED), node('b', ORGANIZATION, 'a'), node('c', ORGANIZATION), node('p', ORGANIZATION, null, 'x', 'project-1')],
      [
        { kind: 'folder', id: 'a' },
        { kind: 'project', id: 'project-1' },
      ],
    );
    const check = await service.createChecker('org-1', EMPLOYEE);

    expect([check('a'), check('b'), check('c'), check('p'), check('b')]).toEqual([true, true, true, true, true]);
    expect(folderRepo.find).toHaveBeenCalledTimes(1);
    expect(folderRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-1' } }));
    expect(folderRepo.query).toHaveBeenCalledTimes(1);
    // Employee: KHONG mo rong theo phong ban ($4 = null) - phong ban chi dung cho FolderShare ($3).
    expect(folderRepo.query).toHaveBeenCalledWith(GRANTS_SQL, ['org-1', 'emp-1', 'dept-1', null]);
  });

  it('loadGrants: Manager theo phong ban -> truyen phong ban vao tham so mo rong du an ($4)', async () => {
    const { service, folderRepo } = buildService([], [{ kind: 'project', id: 'project-9' }]);
    const result = await service.loadGrants('org-1', { ...EMPLOYEE, isDepartmentManager: true });
    expect(folderRepo.query).toHaveBeenCalledWith(GRANTS_SQL, ['org-1', 'emp-1', 'dept-1', 'dept-1']);
    expect([...result.projectIds]).toEqual(['project-9']);
    expect(result.folderIds.size).toBe(0);
  });

  it('createChecker: Org Admin -> khong truy van gi', async () => {
    const { service, folderRepo } = buildService([]);
    const check = await service.createChecker('org-1', { ...EMPLOYEE, isOrgAdmin: true });
    expect(check('bat-ky')).toBe(true);
    expect(folderRepo.find).not.toHaveBeenCalled();
    expect(folderRepo.query).not.toHaveBeenCalled();
  });

  it('createScope: Org Admin nap cay thu muc (de tinh du an) nhung bo qua truy van quyen', async () => {
    const { service, folderRepo } = buildService([node('p', ORGANIZATION, null, 'x', 'project-1'), node('s', ORGANIZATION, 'p')]);
    const scope = await service.createScope('org-1', { ...EMPLOYEE, isOrgAdmin: true });
    expect(scope.folderIds).toEqual(['p', 's']);
    expect(scope.projectIdOf('s')).toBe('project-1');
    expect(scope.canAccess('s')).toBe(true);
    expect(folderRepo.query).not.toHaveBeenCalled();
  });

  it('listAccessibleProjectIds: Org Admin = moi du an cua to chuc; nguoi khac = du an thuoc pham vi', async () => {
    const { service, projectRefRepo } = buildService([], [{ kind: 'project', id: 'project-1' }, { kind: 'folder', id: 'f' }], [
      { projectId: 'project-1' },
      { projectId: 'project-2' },
    ]);
    expect(await service.listAccessibleProjectIds('org-1', { ...EMPLOYEE, isOrgAdmin: true })).toEqual(['project-1', 'project-2']);
    expect(projectRefRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-1' } }));
    expect(await service.listAccessibleProjectIds('org-1', EMPLOYEE)).toEqual(['project-1']);
  });

  it('canAccessFolder: duong tat khong truy van (Org Admin, thu muc toan cong ty cap goc)', async () => {
    const { service, folderRepo } = buildService([]);
    expect(await service.canAccessFolder(asFolder(node('s', RESTRICTED)), { ...EMPLOYEE, isOrgAdmin: true })).toBe(true);
    expect(await service.canAccessFolder(asFolder(node('o', ORGANIZATION)), EMPLOYEE)).toBe(true);
    expect(folderRepo.find).not.toHaveBeenCalled();
  });

  it('canAccessFolder: thu muc cap goc gan du an nguoi goi khong thuoc -> tu choi (khong con duong tat)', async () => {
    const projectRoot = node('p', ORGANIZATION, null, 'emp-1', 'project-1');
    const { service, folderRepo } = buildService([projectRoot]);
    expect(await service.canAccessFolder(asFolder(projectRoot), EMPLOYEE)).toBe(false);
    expect(folderRepo.query).toHaveBeenCalledTimes(1);
  });

  it('canAccessFolder: thu muc con ORGANIZATION trong thu muc cha RESTRICTED -> tu choi', async () => {
    const parent = node('secret', RESTRICTED);
    const child = node('child', ORGANIZATION, 'secret');
    const { service } = buildService([parent, child]);
    expect(await service.canAccessFolder(asFolder(child), EMPLOYEE)).toBe(false);
  });

  it('canAccessFolder: FolderShare theo phong ban tren thu muc RESTRICTED -> cho phep', async () => {
    const secret = node('secret', RESTRICTED);
    const { service } = buildService([secret], [{ kind: 'folder', id: 'secret' }]);
    expect(await service.canAccessFolder(asFolder(secret), EMPLOYEE)).toBe(true);
  });
});

// 26/10/2026: assertCanWrite() - ma loi 403 phan biet "khong xem duoc" va "chi xem (toan cong ty)".
describe('FolderAccessService.assertCanWrite (26/10/2026)', () => {
  const folderRepo = {
    find: jest.fn().mockResolvedValue([node('cw', ORGANIZATION, null, 'admin-1'), node('secret', RESTRICTED, null, 'admin-1')]),
    query: jest.fn().mockResolvedValue([]),
  };
  const service = new FolderAccessService(folderRepo as never, {} as never);

  it('cay toan cong ty -> COMPANY_WIDE_READ_ONLY; khong xem duoc -> FORBIDDEN_FOLDER_ACCESS; Org Admin/goc -> dung quy tac', async () => {
    await expect(service.assertCanWrite('org-1', 'cw', EMPLOYEE)).rejects.toMatchObject({ response: { errorCode: 'COMPANY_WIDE_READ_ONLY' } });
    await expect(service.assertCanWrite('org-1', 'secret', EMPLOYEE)).rejects.toMatchObject({ response: { errorCode: 'FORBIDDEN_FOLDER_ACCESS' } });
    await expect(service.assertCanWrite('org-1', null, EMPLOYEE)).rejects.toMatchObject({ response: { errorCode: 'COMPANY_WIDE_READ_ONLY' } });
    folderRepo.find.mockClear();
    await expect(service.assertCanWrite('org-1', 'cw', { ...EMPLOYEE, isOrgAdmin: true })).resolves.toBeUndefined();
    expect(folderRepo.find).not.toHaveBeenCalled();
  });
});
