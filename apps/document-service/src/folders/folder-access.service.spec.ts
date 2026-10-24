// 28/07/2026: file moi - unit test cho FolderAccessService.canAccessFolder (kiem soat truy cap
// thu muc, opt-in).
// 24/10/2026: viet lai theo quy tac KE THUA tu thu muc cha (resolveFolderAccess) - giu cac duong cu
// (ORGANIZATION / nguoi tao / Org Admin / FolderShare theo user hoac phong ban / tu choi) va bo sung
// thu muc long nhau, quyen tuong minh phu cay con, vong lap du lieu, so truy van.
import { AccessContext, FolderAccessNode, FolderAccessService, MAX_FOLDER_DEPTH, resolveFolderAccess } from './folder-access.service';
import { Folder, FolderVisibility } from '../entities/folder.entity';

const { ORGANIZATION, RESTRICTED } = FolderVisibility;
const EMPLOYEE: AccessContext = { userId: 'emp-1', departmentId: 'dept-1', isOrgAdmin: false };

function node(id: string, visibility: FolderVisibility, parentFolderId: string | null = null, createdByUserId = 'owner-1'): FolderAccessNode {
  return { id, visibility, parentFolderId, createdByUserId };
}
const tree = (...nodes: FolderAccessNode[]) => new Map(nodes.map((n) => [n.id, n]));

describe('resolveFolderAccess (quy tac ke thua)', () => {
  it('thu muc ORGANIZATION cap goc -> ai cung xem duoc; RESTRICTED khong quyen -> tu choi', () => {
    const nodes = tree(node('org', ORGANIZATION), node('secret', RESTRICTED));
    expect(resolveFolderAccess('org', nodes, new Set(), EMPLOYEE)).toBe(true);
    expect(resolveFolderAccess('secret', nodes, new Set(), EMPLOYEE)).toBe(false);
  });

  it('thu muc cha RESTRICTED + thu muc con ORGANIZATION -> con cung bi tu choi (lo hong cu)', () => {
    const nodes = tree(node('secret', RESTRICTED), node('child', ORGANIZATION, 'secret'));
    expect(resolveFolderAccess('child', nodes, new Set(), EMPLOYEE)).toBe(false);
  });

  it('FolderShare CHI tren thu muc con -> xem duoc con, khong xem duoc cha', () => {
    const nodes = tree(node('secret', RESTRICTED), node('child', ORGANIZATION, 'secret'));
    const granted = new Set(['child']);
    expect(resolveFolderAccess('child', nodes, granted, EMPLOYEE)).toBe(true);
    expect(resolveFolderAccess('secret', nodes, granted, EMPLOYEE)).toBe(false);
  });

  it('FolderShare tren thu muc cha -> phu thu muc con ORGANIZATION; con RESTRICTED rieng (khong share) van chan', () => {
    const nodes = tree(node('secret', RESTRICTED), node('child', ORGANIZATION, 'secret'), node('inner', RESTRICTED, 'secret'));
    const granted = new Set(['secret']);
    expect(resolveFolderAccess('child', nodes, granted, EMPLOYEE)).toBe(true);
    expect(resolveFolderAccess('inner', nodes, granted, EMPLOYEE)).toBe(false); // inner tu han che rieng, chan truoc khi toi cha
  });

  it('nguoi tao thu muc con ben trong thu muc cha RESTRICTED -> xem duoc thu muc cua minh', () => {
    const nodes = tree(node('secret', RESTRICTED), node('mine', ORGANIZATION, 'secret', 'emp-1'));
    expect(resolveFolderAccess('mine', nodes, new Set(), EMPLOYEE)).toBe(true);
    expect(resolveFolderAccess('secret', nodes, new Set(), EMPLOYEE)).toBe(false);
  });

  it('3 cap: goc RESTRICTED > ORGANIZATION > ORGANIZATION -> chau bi tu choi; share o goc -> chau xem duoc', () => {
    const nodes = tree(node('a', RESTRICTED), node('b', ORGANIZATION, 'a'), node('c', ORGANIZATION, 'b'));
    expect(resolveFolderAccess('c', nodes, new Set(), EMPLOYEE)).toBe(false);
    expect(resolveFolderAccess('c', nodes, new Set(['a']), EMPLOYEE)).toBe(true);
    // 3 cap toan ORGANIZATION -> cho phep
    const open = tree(node('a', ORGANIZATION), node('b', ORGANIZATION, 'a'), node('c', ORGANIZATION, 'b'));
    expect(resolveFolderAccess('c', open, new Set(), EMPLOYEE)).toBe(true);
  });

  it('du lieu bat thuong -> tu choi: vong lap cha-con, thu muc cha khong ton tai, thu muc khong ton tai, qua sau', () => {
    const cycle = tree(node('x', ORGANIZATION, 'y'), node('y', ORGANIZATION, 'x'));
    expect(resolveFolderAccess('x', cycle, new Set(), EMPLOYEE)).toBe(false);
    expect(resolveFolderAccess('orphan', tree(node('orphan', ORGANIZATION, 'missing')), new Set(), EMPLOYEE)).toBe(false);
    expect(resolveFolderAccess('missing', tree(), new Set(), EMPLOYEE)).toBe(false);

    const deep = Array.from({ length: MAX_FOLDER_DEPTH + 1 }, (_, i) => node(`d${i}`, ORGANIZATION, i === 0 ? null : `d${i - 1}`));
    expect(resolveFolderAccess(`d${MAX_FOLDER_DEPTH}`, tree(...deep), new Set(), EMPLOYEE)).toBe(false);
  });

  it('Org Admin -> luon cho phep (ke ca du lieu bat thuong)', () => {
    const nodes = tree(node('secret', RESTRICTED), node('child', ORGANIZATION, 'secret'));
    expect(resolveFolderAccess('child', nodes, new Set(), { ...EMPLOYEE, isOrgAdmin: true })).toBe(true);
  });
});

describe('FolderAccessService', () => {
  function buildService(folders: FolderAccessNode[], shares: { folderId: string }[] = []) {
    const folderRepo = { find: jest.fn().mockResolvedValue(folders) };
    const folderShareRepo = { find: jest.fn().mockResolvedValue(shares) };
    const service = new FolderAccessService(folderShareRepo as never, folderRepo as never);
    return { service, folderRepo, folderShareRepo };
  }
  const asFolder = (n: FolderAccessNode) => ({ ...n, organizationId: 'org-1' }) as Folder;

  it('createChecker: 2 truy van cho CA request (thu muc cua to chuc + share theo user HOAC phong ban)', async () => {
    const { service, folderRepo, folderShareRepo } = buildService([node('a', RESTRICTED), node('b', ORGANIZATION, 'a'), node('c', ORGANIZATION)], [
      { folderId: 'a' },
    ]);
    const check = await service.createChecker('org-1', EMPLOYEE);

    expect([check('a'), check('b'), check('c'), check('b')]).toEqual([true, true, true, true]);
    expect(folderRepo.find).toHaveBeenCalledTimes(1);
    expect(folderRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-1' } }));
    expect(folderShareRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: [{ sharedWithUserId: 'emp-1' }, { sharedWithDepartmentId: 'dept-1' }] }),
    );
  });

  it('canAccessFolder: duong tat khong truy van (Org Admin, nguoi tao, ORGANIZATION cap goc)', async () => {
    const { service, folderRepo } = buildService([]);
    expect(await service.canAccessFolder(asFolder(node('s', RESTRICTED)), { ...EMPLOYEE, isOrgAdmin: true })).toBe(true);
    expect(await service.canAccessFolder(asFolder(node('s', RESTRICTED, 'p', 'emp-1')), EMPLOYEE)).toBe(true);
    expect(await service.canAccessFolder(asFolder(node('o', ORGANIZATION)), EMPLOYEE)).toBe(true);
    expect(folderRepo.find).not.toHaveBeenCalled();
  });

  it('canAccessFolder: thu muc con ORGANIZATION trong thu muc cha RESTRICTED -> tu choi', async () => {
    const parent = node('secret', RESTRICTED);
    const child = node('child', ORGANIZATION, 'secret');
    const { service } = buildService([parent, child]);
    expect(await service.canAccessFolder(asFolder(child), EMPLOYEE)).toBe(false);
  });

  it('canAccessFolder: FolderShare theo phong ban tren thu muc RESTRICTED -> cho phep', async () => {
    const secret = node('secret', RESTRICTED);
    const { service } = buildService([secret], [{ folderId: 'secret' }]);
    expect(await service.canAccessFolder(asFolder(secret), EMPLOYEE)).toBe(true);
  });
});
