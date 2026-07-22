// 22/07/2026: file moi - test cho FoldersService.findAll (Fix 3/Fix 5, code review). Fix 3 (bo
// sung @RequirePermissions) nam o tang controller (metadata doc boi PermissionsGuard), khong the
// kiem chung o unit test tang service nay - muc dich cua test nay la xac nhan Fix 5 (DTO validate
// UUID o controller) KHONG lam thay doi hanh vi loc du lieu hien co cua FoldersService.findAll
// (dac biet la quy uoc "" tuong duong voi undefined = thu muc goc).
import { FoldersService } from './folders.service';
import { Folder } from '../entities/folder.entity';

describe('FoldersService.findAll', () => {
  function buildService(findMock: jest.Mock) {
    const folderRepo = { find: findMock } as unknown as { find: jest.Mock };
    const dataSource = {} as never;
    const fileMetaRepo = {} as never;
    const fileVersionRepo = {} as never;
    const minioService = {} as never;
    const outboxService = {} as never;
    return new FoldersService(
      dataSource,
      folderRepo as never,
      fileMetaRepo,
      fileVersionRepo,
      minioService,
      outboxService,
    );
  }

  it('loc theo organizationId va coi parentFolderId khong truyen (undefined) la thu muc goc', async () => {
    const findMock = jest.fn().mockResolvedValue([]);
    const service = buildService(findMock);

    await service.findAll('org-1', undefined);

    expect(findMock).toHaveBeenCalledTimes(1);
    const where = findMock.mock.calls[0][0].where;
    expect(where.organizationId).toBe('org-1');
    expect(where.parentFolderId).toBeDefined(); // toan tu IsNull(), khong phai undefined tho
  });

  it('coi parentFolderId la chuoi rong "" cung la thu muc goc, giong het undefined (quy uoc hien tai - Fix 5 khong duoc lam hong dieu nay)', async () => {
    const findMock = jest.fn().mockResolvedValue([]);
    const service = buildService(findMock);

    await service.findAll('org-1', '');

    const where = findMock.mock.calls[0][0].where;
    expect(where.organizationId).toBe('org-1');
    expect(where.parentFolderId).not.toBe('');
  });

  it('loc dung theo parentFolderId khi co gia tri UUID cu the', async () => {
    const findMock = jest.fn().mockResolvedValue([{ id: 'f1' } as Folder]);
    const service = buildService(findMock);

    const result = await service.findAll('org-1', 'parent-uuid');

    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', parentFolderId: 'parent-uuid' },
      }),
    );
    expect(result).toEqual([{ id: 'f1' }]);
  });
});
