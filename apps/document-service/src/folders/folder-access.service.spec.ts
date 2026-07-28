// 28/07/2026: file moi - unit test cho FolderAccessService.canAccessFolder (kiem soat truy cap
// thu muc, opt-in). Bao phu day du 4 duong "duoc phep" + 1 duong "tu choi" mo ta trong yeu cau
// nhiem vu: (1) thu muc ORGANIZATION, (2) la nguoi tao thu muc, (3) la Org Admin, (4) co
// FolderShare khop (theo userId HOAC departmentId), va (5) khong khop dieu kien nao -> tu choi.
import { FolderAccessService, AccessContext } from './folder-access.service';
import { Folder, FolderVisibility } from '../entities/folder.entity';

describe('FolderAccessService.canAccessFolder', () => {
  function buildService(findOneMock: jest.Mock = jest.fn().mockResolvedValue(null)) {
    const folderShareRepo = { findOne: findOneMock };
    const service = new FolderAccessService(folderShareRepo as never);
    return { service, folderShareRepo };
  }

  const restrictedFolder: Pick<Folder, 'id' | 'visibility' | 'createdByUserId'> = {
    id: 'folder-1',
    visibility: FolderVisibility.RESTRICTED,
    createdByUserId: 'owner-1',
  };

  it('[duong 1] cho phep khi thu muc la ORGANIZATION (mac dinh), bat ke nguoi goi la ai', async () => {
    const { service, folderShareRepo } = buildService();
    const organizationFolder = { ...restrictedFolder, visibility: FolderVisibility.ORGANIZATION };
    const ctx: AccessContext = { userId: 'stranger-1', departmentId: null, isOrgAdmin: false };

    const result = await service.canAccessFolder(organizationFolder, ctx);

    expect(result).toBe(true);
    expect(folderShareRepo.findOne).not.toHaveBeenCalled(); // khong can truy van DB - da quyet dinh xong o dieu kien dau.
  });

  it('[duong 2] cho phep khi nguoi goi chinh la nguoi tao thu muc RESTRICTED', async () => {
    const { service, folderShareRepo } = buildService();
    const ctx: AccessContext = { userId: 'owner-1', departmentId: null, isOrgAdmin: false };

    const result = await service.canAccessFolder(restrictedFolder, ctx);

    expect(result).toBe(true);
    expect(folderShareRepo.findOne).not.toHaveBeenCalled();
  });

  it('[duong 3] cho phep khi nguoi goi la Org Admin (du khong phai nguoi tao, khong co FolderShare)', async () => {
    const { service, folderShareRepo } = buildService();
    const ctx: AccessContext = { userId: 'admin-1', departmentId: null, isOrgAdmin: true };

    const result = await service.canAccessFolder(restrictedFolder, ctx);

    expect(result).toBe(true);
    expect(folderShareRepo.findOne).not.toHaveBeenCalled();
  });

  it('[duong 4a] cho phep khi co 1 dong FolderShare khop truc tiep voi userId cua nguoi goi', async () => {
    const findOneMock = jest.fn().mockResolvedValue({ id: 'share-1', sharedWithUserId: 'member-1' });
    const { service } = buildService(findOneMock);
    const ctx: AccessContext = { userId: 'member-1', departmentId: null, isOrgAdmin: false };

    const result = await service.canAccessFolder(restrictedFolder, ctx);

    expect(result).toBe(true);
    expect(findOneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [{ folderId: 'folder-1', sharedWithUserId: 'member-1' }],
      }),
    );
  });

  it('[duong 4b] cho phep khi co 1 dong FolderShare khop voi departmentId cua nguoi goi (khong khop userId)', async () => {
    const findOneMock = jest.fn().mockResolvedValue({ id: 'share-1', sharedWithDepartmentId: 'dept-1' });
    const { service } = buildService(findOneMock);
    const ctx: AccessContext = { userId: 'member-1', departmentId: 'dept-1', isOrgAdmin: false };

    const result = await service.canAccessFolder(restrictedFolder, ctx);

    expect(result).toBe(true);
    // Ca 2 dieu kien (userId VA departmentId) phai duoc dua vao 1 truy van OR DUY NHAT.
    expect(findOneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          { folderId: 'folder-1', sharedWithUserId: 'member-1' },
          { folderId: 'folder-1', sharedWithDepartmentId: 'dept-1' },
        ],
      }),
    );
  });

  it('khong dua dieu kien departmentId vao truy van khi ctx.departmentId la null (nguoi dung chua duoc gan phong ban)', async () => {
    const findOneMock = jest.fn().mockResolvedValue(null);
    const { service } = buildService(findOneMock);
    const ctx: AccessContext = { userId: 'member-1', departmentId: null, isOrgAdmin: false };

    await service.canAccessFolder(restrictedFolder, ctx);

    expect(findOneMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: [{ folderId: 'folder-1', sharedWithUserId: 'member-1' }] }),
    );
  });

  it('[duong tu choi] tra ve false khi thu muc RESTRICTED, khong phai nguoi tao/Org Admin, khong co FolderShare khop', async () => {
    const findOneMock = jest.fn().mockResolvedValue(null);
    const { service } = buildService(findOneMock);
    const ctx: AccessContext = { userId: 'stranger-1', departmentId: 'dept-khac', isOrgAdmin: false };

    const result = await service.canAccessFolder(restrictedFolder, ctx);

    expect(result).toBe(false);
  });
});
