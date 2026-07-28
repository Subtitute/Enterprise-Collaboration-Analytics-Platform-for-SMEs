// 22/07/2026: file moi - test cho FoldersService.findAll (Fix 3/Fix 5, code review). Fix 3 (bo
// sung @RequirePermissions) nam o tang controller (metadata doc boi PermissionsGuard), khong the
// kiem chung o unit test tang service nay - muc dich cua test nay la xac nhan Fix 5 (DTO validate
// UUID o controller) KHONG lam thay doi hanh vi loc du lieu hien co cua FoldersService.findAll
// (dac biet la quy uoc "" tuong duong voi undefined = thu muc goc).
//
// 28/07/2026: bo sung ho tro `ctx`/`FolderAccessService` (constructor co them folderShareRepo +
// folderAccessService - kiem soat truy cap thu muc, opt-in) VA cac describe block moi cho
// update()/createShare()/listShares()/removeShare().
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FoldersService } from './folders.service';
import { Folder, FolderVisibility } from '../entities/folder.entity';
import { AccessContext } from './folder-access.service';

const CTX: AccessContext = { userId: 'user-1', departmentId: null, isOrgAdmin: false };

describe('FoldersService.findAll', () => {
  function buildService(findMock: jest.Mock, canAccessFolderMock: jest.Mock = jest.fn().mockResolvedValue(true)) {
    const folderRepo = { find: findMock } as unknown as { find: jest.Mock };
    const dataSource = {} as never;
    const fileMetaRepo = {} as never;
    const fileVersionRepo = {} as never;
    const folderShareRepo = {} as never;
    const minioService = {} as never;
    const outboxService = {} as never;
    const folderAccessService = { canAccessFolder: canAccessFolderMock } as never;
    return new FoldersService(
      dataSource,
      folderRepo as never,
      fileMetaRepo,
      fileVersionRepo,
      folderShareRepo,
      minioService,
      outboxService,
      folderAccessService,
    );
  }

  it('loc theo organizationId va coi parentFolderId khong truyen (undefined) la thu muc goc', async () => {
    const findMock = jest.fn().mockResolvedValue([]);
    const service = buildService(findMock);

    await service.findAll('org-1', undefined, CTX);

    expect(findMock).toHaveBeenCalledTimes(1);
    const where = findMock.mock.calls[0][0].where;
    expect(where.organizationId).toBe('org-1');
    expect(where.parentFolderId).toBeDefined(); // toan tu IsNull(), khong phai undefined tho
  });

  it('coi parentFolderId la chuoi rong "" cung la thu muc goc, giong het undefined (quy uoc hien tai - Fix 5 khong duoc lam hong dieu nay)', async () => {
    const findMock = jest.fn().mockResolvedValue([]);
    const service = buildService(findMock);

    await service.findAll('org-1', '', CTX);

    const where = findMock.mock.calls[0][0].where;
    expect(where.organizationId).toBe('org-1');
    expect(where.parentFolderId).not.toBe('');
  });

  it('loc dung theo parentFolderId khi co gia tri UUID cu the', async () => {
    const findMock = jest.fn().mockResolvedValue([{ id: 'f1' } as Folder]);
    const service = buildService(findMock);

    const result = await service.findAll('org-1', 'parent-uuid', CTX);

    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', parentFolderId: 'parent-uuid' },
      }),
    );
    expect(result).toEqual([{ id: 'f1' }]);
  });

  // 28/07/2026: test moi - kiem soat truy cap thu muc (opt-in): findAll() phai loc BO LANG (khong
  // nem loi) cac thu muc RESTRICTED ma nguoi goi khong xem duoc, giu lai nhung thu muc con lai,
  // dung thu tu ban dau.
  it('loc bo lang cac thu muc RESTRICTED nguoi goi khong xem duoc, giu nguyen nhung thu muc con lai', async () => {
    const folders = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }] as Folder[];
    const findMock = jest.fn().mockResolvedValue(folders);
    const canAccessFolderMock = jest
      .fn()
      .mockResolvedValueOnce(true) // f1: duoc xem
      .mockResolvedValueOnce(false) // f2: KHONG duoc xem
      .mockResolvedValueOnce(true); // f3: duoc xem
    const service = buildService(findMock, canAccessFolderMock);

    const result = await service.findAll('org-1', undefined, CTX);

    expect(result).toEqual([{ id: 'f1' }, { id: 'f3' }]);
    expect(canAccessFolderMock).toHaveBeenCalledTimes(3);
  });
});

describe('FoldersService.update - kiem soat truy cap thu muc (opt-in, 28/07/2026)', () => {
  function buildService(overrides: {
    folder?: Partial<Folder> | null;
    canAccessFolder?: boolean;
    save?: jest.Mock;
  }) {
    const folder: Folder | null =
      overrides.folder === null
        ? null
        : ({
            id: 'folder-1',
            organizationId: 'org-1',
            name: 'Cu',
            createdByUserId: 'owner-1',
            visibility: FolderVisibility.RESTRICTED,
            ...overrides.folder,
          } as Folder);
    const saveMock = overrides.save ?? jest.fn().mockImplementation((f) => Promise.resolve(f));
    const folderRepo = { findOne: jest.fn().mockResolvedValue(folder), save: saveMock };
    const canAccessFolderMock = jest.fn().mockResolvedValue(overrides.canAccessFolder ?? true);
    const folderAccessService = { canAccessFolder: canAccessFolderMock } as never;
    const service = new FoldersService(
      {} as never,
      folderRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      folderAccessService,
    );
    return { service, folderRepo, saveMock, canAccessFolderMock };
  }

  it('nem ForbiddenException neu nguoi goi khong xem duoc thu muc (canAccessFolder = false)', async () => {
    const { service } = buildService({ canAccessFolder: false });

    await expect(service.update('org-1', 'folder-1', { name: 'Moi' }, CTX)).rejects.toThrow(ForbiddenException);
  });

  it('cho phep doi ten (khong dong cham visibility) neu chi la thanh vien co quyen xem thu muc, khong phai nguoi tao/Org Admin', async () => {
    const { service, saveMock } = buildService({ canAccessFolder: true });

    await service.update('org-1', 'folder-1', { name: 'Ten moi' }, CTX);

    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ten moi' }));
  });

  it('tu choi (ForbiddenException) doi visibility khi nguoi goi KHONG PHAI nguoi tao thu muc VA khong phai Org Admin', async () => {
    const { service, saveMock } = buildService({ canAccessFolder: true, folder: { createdByUserId: 'nguoi-khac' } });

    await expect(
      service.update('org-1', 'folder-1', { name: 'Ten moi', visibility: FolderVisibility.ORGANIZATION }, CTX),
    ).rejects.toThrow(ForbiddenException);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('cho phep doi visibility khi nguoi goi la nguoi tao thu muc', async () => {
    const ownerCtx: AccessContext = { userId: 'owner-1', departmentId: null, isOrgAdmin: false };
    const { service, saveMock } = buildService({ canAccessFolder: true, folder: { createdByUserId: 'owner-1' } });

    await service.update('org-1', 'folder-1', { name: 'Ten moi', visibility: FolderVisibility.ORGANIZATION }, ownerCtx);

    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ visibility: FolderVisibility.ORGANIZATION }));
  });

  it('cho phep doi visibility khi nguoi goi la Org Admin (du khong phai nguoi tao)', async () => {
    const adminCtx: AccessContext = { userId: 'admin-1', departmentId: null, isOrgAdmin: true };
    const { service, saveMock } = buildService({ canAccessFolder: true, folder: { createdByUserId: 'nguoi-khac' } });

    await service.update('org-1', 'folder-1', { name: 'Ten moi', visibility: FolderVisibility.RESTRICTED }, adminCtx);

    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ visibility: FolderVisibility.RESTRICTED }));
  });
});

describe('FoldersService - endpoint chia se thu muc (POST/GET/DELETE /folders/:id/shares, 28/07/2026)', () => {
  const folder = {
    id: 'folder-1',
    organizationId: 'org-1',
    createdByUserId: 'owner-1',
    visibility: FolderVisibility.RESTRICTED,
  } as Folder;
  const ownerCtx: AccessContext = { userId: 'owner-1', departmentId: null, isOrgAdmin: false };
  const strangerCtx: AccessContext = { userId: 'stranger-1', departmentId: null, isOrgAdmin: false };

  function buildService(overrides: { existingShare?: unknown } = {}) {
    const folderRepo = { findOne: jest.fn().mockResolvedValue(folder) };
    const folderShareRepo = {
      findOne: jest.fn().mockResolvedValue(overrides.existingShare ?? null),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'share-1', ...data })),
      find: jest.fn().mockResolvedValue([{ id: 'share-1' }]),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const service = new FoldersService(
      {} as never,
      folderRepo as never,
      {} as never,
      {} as never,
      folderShareRepo as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, folderRepo, folderShareRepo };
  }

  it('createShare: tu choi (ForbiddenException) khi nguoi goi khong phai nguoi tao thu muc/Org Admin', async () => {
    const { service } = buildService();

    await expect(
      service.createShare('org-1', 'folder-1', strangerCtx, { sharedWithUserId: 'target-1' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('createShare: tu choi (BadRequestException) khi cung cap CA sharedWithUserId LAN sharedWithDepartmentId', async () => {
    const { service } = buildService();

    await expect(
      service.createShare('org-1', 'folder-1', ownerCtx, {
        sharedWithUserId: 'target-1',
        sharedWithDepartmentId: 'dept-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('createShare: tu choi (BadRequestException) khi KHONG cung cap ca sharedWithUserId LAN sharedWithDepartmentId', async () => {
    const { service } = buildService();

    await expect(service.createShare('org-1', 'folder-1', ownerCtx, {})).rejects.toThrow(BadRequestException);
  });

  it('createShare: tao thanh cong chia se theo user khi nguoi goi la nguoi tao thu muc', async () => {
    const { service, folderShareRepo } = buildService();

    const result = await service.createShare('org-1', 'folder-1', ownerCtx, { sharedWithUserId: 'target-1' });

    expect(folderShareRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 'folder-1', sharedWithUserId: 'target-1', sharedWithDepartmentId: null }),
    );
    expect(result).toEqual(expect.objectContaining({ sharedWithUserId: 'target-1' }));
  });

  it('createShare: tu choi (BadRequestException) khi thu muc DA duoc chia se voi dung nguoi dung do', async () => {
    const { service } = buildService({ existingShare: { id: 'share-cu' } });

    await expect(
      service.createShare('org-1', 'folder-1', ownerCtx, { sharedWithUserId: 'target-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('listShares: tu choi (ForbiddenException) khi nguoi goi khong phai nguoi tao/Org Admin', async () => {
    const { service } = buildService();

    await expect(service.listShares('org-1', 'folder-1', strangerCtx)).rejects.toThrow(ForbiddenException);
  });

  it('listShares: tra ve danh sach chia se khi nguoi goi la nguoi tao thu muc', async () => {
    const { service, folderShareRepo } = buildService();

    const result = await service.listShares('org-1', 'folder-1', ownerCtx);

    expect(folderShareRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { folderId: 'folder-1' } }));
    expect(result).toEqual([{ id: 'share-1' }]);
  });

  it('removeShare: tu choi (ForbiddenException) khi nguoi goi khong phai nguoi tao/Org Admin', async () => {
    const { service } = buildService();

    await expect(service.removeShare('org-1', 'folder-1', 'share-1', strangerCtx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('removeShare: nem NotFoundException khi shareId khong ton tai trong thu muc do', async () => {
    const { service, folderShareRepo } = buildService();
    folderShareRepo.findOne.mockResolvedValue(null);

    await expect(service.removeShare('org-1', 'folder-1', 'khong-ton-tai', ownerCtx)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('removeShare: xoa thanh cong khi nguoi goi la nguoi tao thu muc va shareId hop le', async () => {
    const { service, folderShareRepo } = buildService();
    folderShareRepo.findOne.mockResolvedValue({ id: 'share-1', folderId: 'folder-1' });

    await service.removeShare('org-1', 'folder-1', 'share-1', ownerCtx);

    expect(folderShareRepo.remove).toHaveBeenCalledWith({ id: 'share-1', folderId: 'folder-1' });
  });
});
