// 25/07/2026: file moi - test-coverage debt tu dot audit truoc: CHUA co unit test nao khoa lai
// hanh vi "upload()/uploadNewVersion() PHAI goi sanitizeFileName() va
// verifyFileContentMatchesMimeType()" (2 ham bo sung o Fix 1/Fix 4, code review 22/07/2026) - 1
// regression xoa nham 2 loi goi nay se KHONG bi `npm test` phat hien. File nay bo sung dung phan
// con thieu do, cong voi test cho 2 fix MOI trong dot audit nay: MAJOR 1 (ep disposition=attachment
// cho mimeType khong the doi chieu magic-byte trong getDownloadUrl()) va MAJOR 2 (validate folderId
// o FilesController.upload() truoc khi xuong service).
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { AccessContext } from '../folders/folder-access.service';
import { FolderVisibility } from '../entities/folder.entity';
import * as sanitizeUtil from './utils/sanitize-filename.util';
import * as mimeUtil from './allowed-mime-types';

afterEach(() => {
  jest.restoreAllMocks();
});

// 28/07/2026: ngu canh dung chung cho cac test KHONG lien quan truc tiep den kiem soat truy cap
// thu muc (upload()/uploadNewVersion() phan Fix cu, getDownloadUrl() phan MAJOR fix 1 cu) - cac
// file duoc dung trong nhung test do deu o cap ROOT (khong co `folderId`) nen LUON duoc phep bat
// ke noi dung CTX nay la gi.
const CTX: AccessContext = { userId: 'actor-1', departmentId: null, isOrgAdmin: false };
// 26/10/2026: ghi (phien ban moi/chia se/xoa) tep cap ROOT gio chi Org Admin (xem canAccessFile()) - cac
// test khoa/race ben duoi dung tep ROOT de bo qua kiem tra thu muc nen chay bang Org Admin.
const ROOT_WRITER_CTX: AccessContext = { ...CTX, isOrgAdmin: true };

// 26/10/2026: FolderAccessService gia lap - writeAccess()/assertCanWrite() (quyen GHI, cay toan cong ty chi
// Org Admin) suy tu canAccessFolder cho cac test cu (cay du an: xem duoc = ghi duoc); quy tac that o
// folder-access.service.spec.ts va test "cay toan cong ty" cuoi file nay.
function folderAccessMock(canAccess = true) {
  const canAccessFolder = jest.fn().mockResolvedValue(canAccess);
  const allowed = async () => Boolean(await canAccessFolder.getMockImplementation()?.());
  const writeAccess = jest.fn(async () => ((await allowed()) ? 'allowed' : 'no-access'));
  const assertCanWrite = jest.fn(async () => {
    if (!(await allowed())) throw new ForbiddenException('khong co quyen');
  });
  return { canAccessFolder, writeAccess, assertCanWrite };
}

function buildMulterFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    originalname: 'bao-cao.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 noi dung gia lap'),
    size: 100,
    ...overrides,
  } as Express.Multer.File;
}

describe('FilesService.upload - fix code review 22/07/2026 (Fix 1 sanitizeFileName, Fix 4 verifyFileContentMatchesMimeType)', () => {
  const organizationId = 'org-1';
  const actorId = 'actor-1';

  function buildService() {
    const managerMock = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      create: jest.fn().mockImplementation((_entityClass: unknown, data: unknown) => data),
    };
    const dataSourceMock = { transaction: jest.fn((cb: (m: typeof managerMock) => unknown) => cb(managerMock)) };
    const folderRepoMock = { findOne: jest.fn() };
    const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };
    const minioServiceMock = { putObject: jest.fn().mockResolvedValue(undefined) };
    // 28/07/2026: repo/service moi cho kiem soat truy cap thu muc (opt-in) - constructor can du 8 tham so.
    // 24/10/2026: upload() nay kiem tra canAccessFolder cua thu muc dich (test o cuoi describe).
    const fileShareRepoMock = {} as never;
    const folderAccessServiceMock = folderAccessMock(true);

    const service = new FilesService(
      dataSourceMock as never,
      {} as never,
      {} as never,
      fileShareRepoMock,
      folderRepoMock as never,
      outboxServiceMock as never,
      minioServiceMock as never,
      folderAccessServiceMock as never,
    );
    return { service, managerMock, minioServiceMock, folderRepoMock, folderAccessServiceMock };
  }
  const uploaderCtx: AccessContext = { userId: actorId, departmentId: null, isOrgAdmin: false };

  it('goi CA sanitizeFileName LAN verifyFileContentMatchesMimeType TRUOC khi ghi len MinIO/DB', async () => {
    const sanitizeSpy = jest.spyOn(sanitizeUtil, 'sanitizeFileName');
    const verifySpy = jest.spyOn(mimeUtil, 'verifyFileContentMatchesMimeType');
    const { service, minioServiceMock } = buildService();
    const file = buildMulterFile();

    // 26/10/2026: thu muc goc gio chi Org Admin tai len duoc (tai lieu toan cong ty) - xem test cuoi describe.
    await service.upload(organizationId, actorId, null, file, { ...uploaderCtx, isOrgAdmin: true });

    expect(sanitizeSpy).toHaveBeenCalledWith(file.originalname);
    expect(verifySpy).toHaveBeenCalledWith(file);
    expect(minioServiceMock.putObject).toHaveBeenCalledTimes(1);
  });

  it('tu choi upload (KHONG goi MinIO putObject) khi verifyFileContentMatchesMimeType phat hien noi dung gia mao', async () => {
    jest.spyOn(mimeUtil, 'verifyFileContentMatchesMimeType').mockImplementation(() => {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Noi dung file khong khop voi loai duoc khai bao',
      });
    });
    const { service, minioServiceMock } = buildService();
    // mimetype khai bao la PDF nhung buffer thuc te la HTML - dung dung kich ban XSS trong finding.
    const file = buildMulterFile({ buffer: Buffer.from('<html><script>evil()</script></html>') });

    await expect(service.upload(organizationId, actorId, null, file, uploaderCtx)).rejects.toThrow(BadRequestException);
    expect(minioServiceMock.putObject).not.toHaveBeenCalled();
  });
  // 24/10/2026: upload vao thu muc RESTRICTED khong co quyen -> 403, KHONG ghi gi len MinIO/DB.
  it('tu choi (ForbiddenException) upload vao thu muc nguoi goi khong xem duoc, khong ghi MinIO', async () => {
    const { service, minioServiceMock, folderRepoMock, folderAccessServiceMock, managerMock } = buildService();
    folderRepoMock.findOne.mockResolvedValue({ id: 'folder-secret', organizationId, visibility: FolderVisibility.RESTRICTED });
    folderAccessServiceMock.canAccessFolder.mockResolvedValue(false);

    await expect(service.upload(organizationId, actorId, 'folder-secret', buildMulterFile(), uploaderCtx)).rejects.toThrow(ForbiddenException);
    // 26/10/2026: tai len = GHI -> assertCanWrite (cay toan cong ty chi Org Admin).
    expect(folderAccessServiceMock.assertCanWrite).toHaveBeenCalledWith(organizationId, 'folder-secret', uploaderCtx);
    expect(minioServiceMock.putObject).not.toHaveBeenCalled();
    expect(managerMock.save).not.toHaveBeenCalled();
  });

  // 26/10/2026: tep o thu muc goc = tai lieu toan cong ty -> chi Org Admin; nguoi khac 403, khong ghi MinIO.
  it('tu choi (ForbiddenException COMPANY_WIDE_ADMIN_ONLY) Employee/Manager tai len thu muc goc', async () => {
    const { service, minioServiceMock, managerMock } = buildService();
    await expect(service.upload(organizationId, actorId, null, buildMulterFile(), uploaderCtx)).rejects.toMatchObject({
      response: { errorCode: 'COMPANY_WIDE_ADMIN_ONLY' },
    });
    expect(minioServiceMock.putObject).not.toHaveBeenCalled();
    expect(managerMock.save).not.toHaveBeenCalled();
  });
});

describe('FilesService.uploadNewVersion - fix code review 22/07/2026 (Fix 1/Fix 2 khoa pessimistic_write/Fix 4)', () => {
  const organizationId = 'org-1';
  const actorId = 'actor-1';
  const fileId = 'file-1';

  function buildService(existingFileMeta: Record<string, unknown> | null) {
    const managerMock = {
      findOne: jest.fn().mockResolvedValue(existingFileMeta),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      create: jest.fn().mockImplementation((_entityClass: unknown, data: unknown) => data),
      find: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const dataSourceMock = { transaction: jest.fn((cb: (m: typeof managerMock) => unknown) => cb(managerMock)) };
    const minioServiceMock = {
      putObject: jest.fn().mockResolvedValue(undefined),
      removeObject: jest.fn().mockResolvedValue(undefined),
    };
    const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };
    // 28/07/2026: uploadNewVersion() gio doc `fileMetaRepo.findOne` 1 lan (KHONG khoa) TRUOC khi mo
    // transaction, chi de kiem tra quyen truy cap (kiem soat truy cap thu muc, opt-in) - tra ve
    // CUNG `existingFileMeta` (khong co `folderId` -> cap ROOT -> luon duoc phep, khong can goi
    // toi folderRepo/folderAccessService).
    const fileMetaRepoMock = { findOne: jest.fn().mockResolvedValue(existingFileMeta) };
    const folderAccessServiceMock = folderAccessMock(true);

    const service = new FilesService(
      dataSourceMock as never,
      fileMetaRepoMock as never,
      {} as never,
      {} as never,
      {} as never,
      outboxServiceMock as never,
      minioServiceMock as never,
      folderAccessServiceMock as never,
    );
    return { service, managerMock, minioServiceMock, fileMetaRepoMock };
  }

  it('goi CA sanitizeFileName LAN verifyFileContentMatchesMimeType, VA khoa row bang pessimistic_write TRUOC khi tinh versionNumber', async () => {
    const existingFileMeta = {
      id: fileId,
      organizationId,
      currentVersion: 1,
      fileName: 'bao-cao.pdf',
      mimeType: 'application/pdf',
    };
    const sanitizeSpy = jest.spyOn(sanitizeUtil, 'sanitizeFileName');
    const verifySpy = jest.spyOn(mimeUtil, 'verifyFileContentMatchesMimeType');
    const { service, managerMock, minioServiceMock } = buildService(existingFileMeta);
    const file = buildMulterFile({ originalname: 'bao-cao-v2.pdf' });

    const result = await service.uploadNewVersion(organizationId, actorId, fileId, file, ROOT_WRITER_CTX);

    expect(sanitizeSpy).toHaveBeenCalledWith(file.originalname);
    expect(verifySpy).toHaveBeenCalledWith(file);
    // Fix 2 (code review 22/07/2026): PHAI khoa row bang pessimistic_write TRUOC khi doc
    // currentVersion, tranh 2 request dong thoi tinh ra CUNG 1 versionNumber/object key.
    expect(managerMock.findOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        where: { id: fileId, organizationId },
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(minioServiceMock.putObject).toHaveBeenCalledTimes(1);
    expect(result.currentVersion).toBe(2);
  });

  it('tu choi (KHONG goi MinIO putObject, KHONG mo transaction khoa row) khi noi dung gia mao mimetype khai bao', async () => {
    jest.spyOn(mimeUtil, 'verifyFileContentMatchesMimeType').mockImplementation(() => {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Noi dung file khong khop voi loai duoc khai bao',
      });
    });
    const existingFileMeta = {
      id: fileId,
      organizationId,
      currentVersion: 1,
      fileName: 'bao-cao.pdf',
      mimeType: 'application/pdf',
    };
    const { service, managerMock, minioServiceMock } = buildService(existingFileMeta);
    const file = buildMulterFile({ buffer: Buffer.from('gia mao') });

    await expect(service.uploadNewVersion(organizationId, actorId, fileId, file, ROOT_WRITER_CTX)).rejects.toThrow(
      BadRequestException,
    );
    expect(minioServiceMock.putObject).not.toHaveBeenCalled();
    expect(managerMock.findOne).not.toHaveBeenCalled();
  });
});

describe('FilesService.getDownloadUrl - MAJOR fix 1 (audit round 25/07/2026): ep attachment cho mimeType khong the doi chieu magic-byte', () => {
  const organizationId = 'org-1';
  const fileId = 'file-1';

  function buildService(fileMeta: Record<string, unknown> | null) {
    const fileMetaRepoMock = { findOne: jest.fn().mockResolvedValue(fileMeta) };
    const minioServiceMock = {
      presignedGetObject: jest.fn().mockResolvedValue('https://minio.local/signed-url'),
    };
    // 28/07/2026: repo/service moi cho kiem soat truy cap thu muc (opt-in) - khong dung toi trong
    // cac test o describe nay (`fileMeta` khong co `folderId` -> cap ROOT -> luon duoc phep).
    const service = new FilesService(
      {} as never,
      fileMetaRepoMock as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      minioServiceMock as never,
      folderAccessMock(true) as never,
    );
    return { service, minioServiceMock };
  }

  it('EP ve attachment cho text/plain du FE yeu cau inline (chan stored content-sniffing XSS)', async () => {
    const fileMeta = {
      id: fileId,
      organizationId,
      objectKey: 'org-1/file-1/v1/note.txt',
      fileName: 'note.txt',
      mimeType: 'text/plain',
    };
    const { service, minioServiceMock } = buildService(fileMeta);

    await service.getDownloadUrl(organizationId, fileId, 'inline', CTX);

    const respHeaders = minioServiceMock.presignedGetObject.mock.calls[0][2];
    expect(respHeaders['response-content-disposition']).toMatch(/^attachment;/);
  });

  it('EP ve attachment cho text/csv du FE yeu cau inline, cung ly do voi text/plain', async () => {
    const fileMeta = {
      id: fileId,
      organizationId,
      objectKey: 'org-1/file-1/v1/data.csv',
      fileName: 'data.csv',
      mimeType: 'text/csv',
    };
    const { service, minioServiceMock } = buildService(fileMeta);

    await service.getDownloadUrl(organizationId, fileId, 'inline', CTX);

    const respHeaders = minioServiceMock.presignedGetObject.mock.calls[0][2];
    expect(respHeaders['response-content-disposition']).toMatch(/^attachment;/);
  });

  it('VAN cho phep inline voi loai CO magic-byte check dang tin cay (vd application/pdf) - khong lam hong tinh nang "Xem" hop le', async () => {
    const fileMeta = {
      id: fileId,
      organizationId,
      objectKey: 'org-1/file-1/v1/bao-cao.pdf',
      fileName: 'bao-cao.pdf',
      mimeType: 'application/pdf',
    };
    const { service, minioServiceMock } = buildService(fileMeta);

    await service.getDownloadUrl(organizationId, fileId, 'inline', CTX);

    const respHeaders = minioServiceMock.presignedGetObject.mock.calls[0][2];
    expect(respHeaders['response-content-disposition']).toMatch(/^inline;/);
  });

  it('mac dinh la attachment cho text/plain khi khong truyen disposition (khop hanh vi mac dinh cu)', async () => {
    const fileMeta = {
      id: fileId,
      organizationId,
      objectKey: 'org-1/file-1/v1/note.txt',
      fileName: 'note.txt',
      mimeType: 'text/plain',
    };
    const { service, minioServiceMock } = buildService(fileMeta);

    await service.getDownloadUrl(organizationId, fileId, undefined, CTX);

    const respHeaders = minioServiceMock.presignedGetObject.mock.calls[0][2];
    expect(respHeaders['response-content-disposition']).toMatch(/^attachment;/);
  });
});

// 28/07/2026: describe block moi - kiem soat truy cap thu muc (opt-in) o tang FilesService. Bao
// phu: (a) file cap ROOT (`folderId` null/undefined) LUON duoc phep, bat ke ctx la gi; (b) "duong
// link rieng" - 1 FileShare TRUC TIEP tren file van cho phep truy cap du thu muc cha RESTRICTED va
// khong co FolderShare o cap thu muc; (c) tu choi khi khong khop dieu kien nao; (d) findAll() tu
// choi TOAN BO (khong loc tung file) khi folderId tro toi 1 thu muc RESTRICTED khong xem duoc.
describe('FilesService - kiem soat truy cap file/thu muc (opt-in, 28/07/2026)', () => {
  const organizationId = 'org-1';
  const fileId = 'file-1';
  const restrictedFolder = {
    id: 'folder-1',
    organizationId,
    visibility: FolderVisibility.RESTRICTED,
    createdByUserId: 'owner-1',
  };
  const strangerCtx: AccessContext = { userId: 'stranger-1', departmentId: null, isOrgAdmin: false };

  function buildService(overrides: {
    fileMeta?: Record<string, unknown> | null;
    folder?: Record<string, unknown> | null;
    canAccessFolder?: boolean;
    fileShare?: Record<string, unknown> | null;
  }) {
    const fileMetaRepoMock = {
      findOne: jest.fn().mockResolvedValue(overrides.fileMeta ?? null),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const fileVersionRepoMock = { find: jest.fn().mockResolvedValue([]) };
    const fileShareRepoMock = { findOne: jest.fn().mockResolvedValue(overrides.fileShare ?? null) };
    const folderRepoMock = { findOne: jest.fn().mockResolvedValue(overrides.folder ?? null) };
    const folderAccessServiceMock = folderAccessMock(overrides.canAccessFolder ?? true);

    const service = new FilesService(
      {} as never,
      fileMetaRepoMock as never,
      fileVersionRepoMock as never,
      fileShareRepoMock as never,
      folderRepoMock as never,
      {} as never,
      {} as never,
      folderAccessServiceMock as never,
    );
    return { service, fileMetaRepoMock, fileShareRepoMock, folderRepoMock, folderAccessServiceMock };
  }

  it('findOne(): file cap ROOT (folderId undefined) LUON duoc phep, khong can tra cuu folderRepo', async () => {
    const { service, folderRepoMock } = buildService({
      fileMeta: { id: fileId, organizationId, fileName: 'a.pdf' },
    });

    await expect(service.findOne(organizationId, fileId, strangerCtx)).resolves.toEqual(
      expect.objectContaining({ id: fileId }),
    );
    expect(folderRepoMock.findOne).not.toHaveBeenCalled();
  });

  it('findOne(): "duong link rieng" - cho phep khi file co 1 FileShare TRUC TIEP khop userId, du thu muc cha RESTRICTED va khong co FolderShare', async () => {
    const { service } = buildService({
      fileMeta: { id: fileId, organizationId, folderId: 'folder-1', fileName: 'hop-dong.pdf' },
      folder: restrictedFolder,
      canAccessFolder: false,
      fileShare: { id: 'share-1', fileId, sharedWithUserId: 'stranger-1' },
    });

    await expect(service.findOne(organizationId, fileId, strangerCtx)).resolves.toEqual(
      expect.objectContaining({ id: fileId }),
    );
  });

  it('findOne(): tu choi (ForbiddenException) khi thu muc RESTRICTED khong xem duoc VA khong co FileShare truc tiep tren file', async () => {
    const { service } = buildService({
      fileMeta: { id: fileId, organizationId, folderId: 'folder-1', fileName: 'hop-dong.pdf' },
      folder: restrictedFolder,
      canAccessFolder: false,
      fileShare: null,
    });

    await expect(service.findOne(organizationId, fileId, strangerCtx)).rejects.toThrow(ForbiddenException);
  });

  it('findOne(): cho phep truc tiep (khong can tra FileShare) khi canAccessFolder tra ve true', async () => {
    const { service, fileShareRepoMock } = buildService({
      fileMeta: { id: fileId, organizationId, folderId: 'folder-1', fileName: 'a.pdf' },
      folder: restrictedFolder,
      canAccessFolder: true,
    });

    await service.findOne(organizationId, fileId, strangerCtx);

    expect(fileShareRepoMock.findOne).not.toHaveBeenCalled();
  });

  it('findAll(): tu choi TOAN BO viec liet ke khi folderId tro toi 1 thu muc RESTRICTED khong xem duoc', async () => {
    const { service } = buildService({ folder: restrictedFolder, canAccessFolder: false });

    await expect(
      service.findAll(organizationId, 'folder-1', { page: 1, limit: 20 } as never, strangerCtx),
    ).rejects.toThrow(ForbiddenException);
  });

  it('findAll(): khong kiem tra quyen thu muc khi folderId khong duoc truyen (danh sach o cap ROOT)', async () => {
    const { service, folderRepoMock } = buildService({});

    await service.findAll(organizationId, undefined, { page: 1, limit: 20 } as never, strangerCtx);

    expect(folderRepoMock.findOne).not.toHaveBeenCalled();
  });

  // 24/10/2026: fail-open -> fail-closed khi FileMeta tro toi thu muc khong ton tai (du lieu bat thuong).
  it('findOne(): thu muc cua file khong ton tai -> tu choi (tru Org Admin)', async () => {
    const fileMeta = { id: fileId, organizationId, fileName: 'a.pdf', folderId: 'folder-missing' };
    const { service } = buildService({ fileMeta, folder: null });
    await expect(service.findOne(organizationId, fileId, strangerCtx)).rejects.toThrow(ForbiddenException);

    const admin = buildService({ fileMeta, folder: null });
    await expect(admin.service.findOne(organizationId, fileId, { ...strangerCtx, isOrgAdmin: true })).resolves.toEqual(
      expect.objectContaining({ id: fileId }),
    );
  });
});

// 24/10/2026: bo loc hang loat cho RAG search-chunks - CUNG quy tac canAccessFile() (root luon duoc,
// thu muc theo FolderAccessService co ke thua, ngoai le FileShare truc tiep), so truy van co dinh.
describe('FilesService.createFileAccessFilter', () => {
  const ctx: AccessContext = { userId: 'emp-1', departmentId: 'dept-1', isOrgAdmin: false };

  function buildService(directShares: { fileId: string }[]) {
    const fileShareRepoMock = { find: jest.fn().mockResolvedValue(directShares) };
    const checker = jest.fn((folderId: string) => folderId === 'folder-open');
    const folderAccessServiceMock = { createChecker: jest.fn().mockResolvedValue(checker) };
    const service = new FilesService(
      {} as never,
      {} as never,
      {} as never,
      fileShareRepoMock as never,
      {} as never,
      {} as never,
      {} as never,
      folderAccessServiceMock as never,
    );
    return { service, fileShareRepoMock, folderAccessServiceMock };
  }

  it('root/thu muc xem duoc/FileShare truc tiep -> cho phep; con lai tu choi; 1 truy van FileShare cho ca lo', async () => {
    const { service, fileShareRepoMock, folderAccessServiceMock } = buildService([{ fileId: 'f-direct' }]);
    const canAccess = await service.createFileAccessFilter('org-1', ctx);

    expect(canAccess({ id: 'f-root', folderId: null })).toBe(true);
    expect(canAccess({ id: 'f-open', folderId: 'folder-open' })).toBe(true);
    expect(canAccess({ id: 'f-direct', folderId: 'folder-secret' })).toBe(true);
    expect(canAccess({ id: 'f-secret', folderId: 'folder-secret' })).toBe(false);
    expect(folderAccessServiceMock.createChecker).toHaveBeenCalledWith('org-1', ctx);
    expect(fileShareRepoMock.find).toHaveBeenCalledTimes(1);
    expect(fileShareRepoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: [{ sharedWithUserId: 'emp-1' }, { sharedWithDepartmentId: 'dept-1' }] }),
    );
  });

  it('Org Admin -> cho phep moi file, khong truy van gi', async () => {
    const { service, fileShareRepoMock, folderAccessServiceMock } = buildService([]);
    const canAccess = await service.createFileAccessFilter('org-1', { ...ctx, isOrgAdmin: true });
    expect(canAccess({ id: 'f-secret', folderId: 'folder-secret' })).toBe(true);
    expect(folderAccessServiceMock.createChecker).not.toHaveBeenCalled();
    expect(fileShareRepoMock.find).not.toHaveBeenCalled();
  });
});

// 26/10/2026: GET /files?projectId= (muc "Tai lieu" o trang chi tiet du an) - chi tep trong thu muc
// nguoi goi xem duoc VA co du an hieu luc dung projectId (ke ca thu muc con).
describe('FilesService.findAll - loc theo du an', () => {
  const ctx: AccessContext = { userId: 'emp-1', departmentId: 'dept-1', isOrgAdmin: false };
  const query = { page: 1, limit: 20 } as never;

  function buildService(scope: { folderIds: string[]; projectOf: Record<string, string | null>; denied?: string[] }) {
    const fileMetaRepo = { findAndCount: jest.fn().mockResolvedValue([[{ id: 'f1', folderId: 'p1' }], 1]) };
    const folderAccessServiceMock = {
      createScope: jest.fn().mockResolvedValue({
        folderIds: scope.folderIds,
        canAccess: (id: string) => !(scope.denied ?? []).includes(id),
        projectIdOf: (id: string) => scope.projectOf[id] ?? null,
        // 26/10/2026: co canWrite tung tep (withWriteFlags) - cay du an ghi duoc.
        writeAccess: () => 'allowed',
      }),
    };
    const fileShareRepo = { find: jest.fn().mockResolvedValue([]) };
    const service = new FilesService(
      {} as never,
      fileMetaRepo as never,
      {} as never,
      fileShareRepo as never,
      {} as never,
      {} as never,
      {} as never,
      folderAccessServiceMock as never,
    );
    return { service, fileMetaRepo };
  }

  it('chi lay tep cua thu muc thuoc du an va xem duoc', async () => {
    const { service, fileMetaRepo } = buildService({
      folderIds: ['p1', 'p1-sub', 'p1-secret', 'p2', 'policy'],
      projectOf: { p1: 'project-1', 'p1-sub': 'project-1', 'p1-secret': 'project-1', p2: 'project-2', policy: null },
      denied: ['p1-secret'],
    });
    const result = await service.findAll('org-1', undefined, query, ctx, 'project-1');

    const where = fileMetaRepo.findAndCount.mock.calls[0][0].where;
    expect(where.organizationId).toBe('org-1');
    expect(where.folderId.value).toEqual(['p1', 'p1-sub']);
    expect(result.data).toEqual([{ id: 'f1', folderId: 'p1', canWrite: true }]);
  });

  it('khong co thu muc nao hop le -> trang rong, khong truy van tep', async () => {
    const { service, fileMetaRepo } = buildService({ folderIds: ['p2'], projectOf: { p2: 'project-2' } });
    const result = await service.findAll('org-1', undefined, query, ctx, 'project-1');
    expect(result.data).toEqual([]);
    expect(fileMetaRepo.findAndCount).not.toHaveBeenCalled();
  });
});

// 26/10/2026: co canWrite tung tep - FileShare EDIT tren 1 tep trong cay toan cong ty (thu muc chi xem) van ghi duoc.
describe('FilesService.findAll - canWrite theo quyen GHI cua chinh tep (26/10/2026)', () => {
  const query = { page: 1, limit: 20 } as never;
  const files = () => [{ id: 'f-edit', folderId: 'policy' }, { id: 'f-view', folderId: 'policy' }];

  function build(ctx: AccessContext, folderWrite: 'allowed' | 'read-only') {
    const fileMetaRepo = { findAndCount: jest.fn().mockResolvedValue([files(), 2]) };
    const fileShareRepo = { find: jest.fn().mockResolvedValue([{ fileId: 'f-edit' }]) };
    const folderRepo = { findOne: jest.fn().mockResolvedValue({ id: 'policy', organizationId: 'org-1' }) };
    const folderAccess = { canAccessFolder: jest.fn().mockResolvedValue(true), writeAccess: jest.fn().mockResolvedValue(folderWrite) };
    const service = new FilesService(
      {} as never,
      fileMetaRepo as never,
      {} as never,
      fileShareRepo as never,
      folderRepo as never,
      {} as never,
      {} as never,
      folderAccess as never,
    );
    return { service, fileShareRepo };
  }

  it('cay toan cong ty: chi tep co FileShare EDIT duoc ghi (1 truy van FileShare cho ca trang)', async () => {
    const ctx: AccessContext = { userId: 'emp-1', departmentId: 'dept-1', isOrgAdmin: false };
    const { service, fileShareRepo } = build(ctx, 'read-only');
    const result = await service.findAll('org-1', 'policy', query, ctx);
    expect(result.data.map((f) => [f.id, (f as { canWrite?: boolean }).canWrite])).toEqual([['f-edit', true], ['f-view', false]]);
    expect(fileShareRepo.find).toHaveBeenCalledTimes(1);
    const where = fileShareRepo.find.mock.calls[0][0].where as Array<Record<string, unknown>>;
    expect(where).toEqual([
      expect.objectContaining({ sharedWithUserId: 'emp-1', permission: 'EDIT' }),
      expect.objectContaining({ sharedWithDepartmentId: 'dept-1', permission: 'EDIT' }),
    ]);
  });

  it('thu muc ghi duoc -> moi tep canWrite; Org Admin khong truy van FileShare', async () => {
    const ctx: AccessContext = { userId: 'emp-1', departmentId: null, isOrgAdmin: false };
    const writable = build(ctx, 'allowed');
    expect((await writable.service.findAll('org-1', 'policy', query, ctx)).data.every((f) => (f as { canWrite?: boolean }).canWrite)).toBe(true);

    const admin = build({ ...ctx, isOrgAdmin: true }, 'read-only');
    const adminResult = await admin.service.findAll('org-1', 'policy', query, { ...ctx, isOrgAdmin: true });
    expect(adminResult.data.every((f) => (f as { canWrite?: boolean }).canWrite)).toBe(true);
    expect(admin.fileShareRepo.find).not.toHaveBeenCalled();
  });
});

// 28/07/2026: describe block moi - FilesService.share() sau khi bo sung chia se theo PHONG BAN
// (`sharedWithDepartmentId`) va kiem tra quyen truy cap file truoc khi cho chia se.
describe('FilesService.share - chia se theo phong ban + kiem soat truy cap (28/07/2026)', () => {
  const organizationId = 'org-1';
  const actorId = 'actor-1';
  const fileId = 'file-1';
  // 26/10/2026: tep cap ROOT - chia se (thao tac ghi) chi Org Admin, xem ROOT_WRITER_CTX.
  const ctx: AccessContext = { userId: actorId, departmentId: null, isOrgAdmin: true };

  function buildService(existingShare: Record<string, unknown> | null = null) {
    const fileMetaRepoMock = {
      findOne: jest.fn().mockResolvedValue({ id: fileId, organizationId, fileName: 'a.pdf' }), // cap ROOT - luon truy cap duoc
    };
    const managerMock = {
      findOne: jest.fn().mockResolvedValue(existingShare),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'share-1', ...entity })),
      create: jest.fn().mockImplementation((_entityClass: unknown, data: unknown) => data),
    };
    const dataSourceMock = { transaction: jest.fn((cb: (m: typeof managerMock) => unknown) => cb(managerMock)) };
    const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };
    const folderAccessServiceMock = folderAccessMock(true);

    const service = new FilesService(
      dataSourceMock as never,
      fileMetaRepoMock as never,
      {} as never,
      {} as never,
      {} as never,
      outboxServiceMock as never,
      {} as never,
      folderAccessServiceMock as never,
    );
    return { service, managerMock, outboxServiceMock };
  }

  it('tu choi (BadRequestException) khi cung cap CA sharedWithUserId LAN sharedWithDepartmentId', async () => {
    const { service } = buildService();

    await expect(
      service.share(organizationId, actorId, fileId, { sharedWithUserId: 'u1', sharedWithDepartmentId: 'd1', permission: 'VIEW' } as never, ctx),
    ).rejects.toThrow(BadRequestException);
  });

  it('tu choi (BadRequestException) khi KHONG cung cap sharedWithUserId LAN sharedWithDepartmentId', async () => {
    const { service } = buildService();

    await expect(
      service.share(organizationId, actorId, fileId, { permission: 'VIEW' } as never, ctx),
    ).rejects.toThrow(BadRequestException);
  });

  it('tao chia se theo PHONG BAN thanh cong: luu dung sharedWithDepartmentId, sharedWithUserId = null, VA KHONG phat outbox event (gioi han da biet, xem comment tai share())', async () => {
    const { service, managerMock, outboxServiceMock } = buildService();

    const result = await service.share(
      organizationId,
      actorId,
      fileId,
      { sharedWithDepartmentId: 'dept-1', permission: 'VIEW' } as never,
      ctx,
    );

    expect(managerMock.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sharedWithUserId: null, sharedWithDepartmentId: 'dept-1' }),
    );
    expect(outboxServiceMock.record).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ sharedWithDepartmentId: 'dept-1' }));
  });

  it('tao chia se theo USER thanh cong (hanh vi cu): luu dung sharedWithUserId VA phat outbox event document.shared', async () => {
    const { service, managerMock, outboxServiceMock } = buildService();

    await service.share(organizationId, actorId, fileId, { sharedWithUserId: 'member-1', permission: 'VIEW' } as never, ctx);

    expect(managerMock.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sharedWithUserId: 'member-1', sharedWithDepartmentId: null }),
    );
    expect(outboxServiceMock.record).toHaveBeenCalledTimes(1);
  });

  it('tu choi (ForbiddenException) khi nguoi chia se khong co quyen truy cap chinh file do', async () => {
    const fileMetaRepoMock = {
      findOne: jest.fn().mockResolvedValue({ id: fileId, organizationId, folderId: 'folder-1', fileName: 'a.pdf' }),
    };
    const folderRepoMock = { findOne: jest.fn().mockResolvedValue({ id: 'folder-1', visibility: FolderVisibility.RESTRICTED, createdByUserId: 'owner-1' }) };
    const fileShareRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
    const folderAccessServiceMock = folderAccessMock(false);
    const service = new FilesService(
      {} as never,
      fileMetaRepoMock as never,
      {} as never,
      fileShareRepoMock as never,
      folderRepoMock as never,
      {} as never,
      {} as never,
      folderAccessServiceMock as never,
    );

    await expect(
      service.share(organizationId, actorId, fileId, { sharedWithUserId: 'member-1', permission: 'VIEW' } as never, ctx),
    ).rejects.toThrow(ForbiddenException);
  });
});

// 28/07/2026: FilesService.remove() gio can kiem tra quyen truy cap truoc khi cho xoa.
describe('FilesService.remove - kiem soat truy cap (28/07/2026)', () => {
  it('tu choi (ForbiddenException) khi nguoi goi khong co quyen truy cap file (thu muc RESTRICTED, khong FileShare truc tiep)', async () => {
    const fileMetaRepoMock = {
      findOne: jest.fn().mockResolvedValue({ id: 'file-1', organizationId: 'org-1', folderId: 'folder-1' }),
    };
    const fileVersionRepoMock = { find: jest.fn().mockResolvedValue([]) };
    const fileShareRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
    const folderRepoMock = {
      findOne: jest.fn().mockResolvedValue({ id: 'folder-1', visibility: FolderVisibility.RESTRICTED, createdByUserId: 'owner-1' }),
    };
    const folderAccessServiceMock = folderAccessMock(false);
    const service = new FilesService(
      {} as never,
      fileMetaRepoMock as never,
      fileVersionRepoMock as never,
      fileShareRepoMock as never,
      folderRepoMock as never,
      {} as never,
      {} as never,
      folderAccessServiceMock as never,
    );
    const ctx: AccessContext = { userId: 'stranger-1', departmentId: null, isOrgAdmin: false };

    await expect(service.remove('org-1', 'stranger-1', 'file-1', ctx)).rejects.toThrow(ForbiddenException);
  });
});

// 25/08/2026: fix code review Major (phat hien qua dot ra soat toan du an lan 3) - remove() truoc
// ban sua nay doc FileVersion TRONG transaction nhung KHONG khoa FileMeta, nen van dua vao THOI
// DIEM doc, khong dong bo voi uploadNewVersion() (ham do khoa pessimistic_write tren cung row).
describe('FilesService.remove - khoa pessimistic_write dong bo voi uploadNewVersion() (25/08/2026)', () => {
  const organizationId = 'org-1';
  const actorId = 'actor-1';
  const fileId = 'file-1';
  // 26/10/2026: tep cap ROOT - xoa (thao tac ghi) chi Org Admin, xem ROOT_WRITER_CTX.
  const ctx: AccessContext = { userId: actorId, departmentId: null, isOrgAdmin: true };
  const rootFileMeta = { id: fileId, organizationId, folderId: null, fileName: 'a.pdf' };

  function buildService(lockedFileMeta: Record<string, unknown> | null, versions: Record<string, unknown>[]) {
    const fileMetaRepoMock = { findOne: jest.fn().mockResolvedValue(rootFileMeta) };
    const managerMock = {
      findOne: jest.fn().mockResolvedValue(lockedFileMeta),
      find: jest.fn().mockResolvedValue(versions),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const dataSourceMock = { transaction: jest.fn((cb: (m: typeof managerMock) => unknown) => cb(managerMock)) };
    const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };
    const minioServiceMock = { removeObject: jest.fn().mockResolvedValue(undefined) };

    const service = new FilesService(
      dataSourceMock as never,
      fileMetaRepoMock as never,
      {} as never,
      {} as never,
      {} as never,
      outboxServiceMock as never,
      minioServiceMock as never,
      {} as never,
    );
    return { service, managerMock, outboxServiceMock, minioServiceMock };
  }

  it('doc lai FileMeta VOI lock pessimistic_write TRUOC khi doc FileVersion (dam bao dong bo voi uploadNewVersion())', async () => {
    const { service, managerMock } = buildService(rootFileMeta, []);

    await service.remove(organizationId, actorId, fileId, ctx);

    expect(managerMock.findOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        where: { id: fileId, organizationId },
        lock: { mode: 'pessimistic_write' },
      }),
    );
    // FileVersion chi duoc doc SAU khi da khoa (thu tu goi: findOne truoc, find sau).
    const findOneOrder = managerMock.findOne.mock.invocationCallOrder[0];
    const findOrder = managerMock.find.mock.invocationCallOrder[0];
    expect(findOneOrder).toBeLessThan(findOrder);
  });

  it('nem NotFoundException neu FileMeta bi xoa GIUA luc pre-check va luc khoa (race that su, khong con doc duoc row)', async () => {
    const { service, managerMock } = buildService(null, []);

    await expect(service.remove(organizationId, actorId, fileId, ctx)).rejects.toThrow(NotFoundException);
    expect(managerMock.remove).not.toHaveBeenCalled();
  });

  it('xoa dung toan bo FileVersion doc duoc TRONG transaction (sau khi khoa) qua MinIO', async () => {
    const versions = [{ objectKey: 'org-1/file-1/v1' }, { objectKey: 'org-1/file-1/v2' }];
    const { service, managerMock, minioServiceMock } = buildService(rootFileMeta, versions);

    await service.remove(organizationId, actorId, fileId, ctx);

    expect(managerMock.remove).toHaveBeenCalledWith(rootFileMeta);
    expect(minioServiceMock.removeObject).toHaveBeenCalledTimes(2);
    expect(minioServiceMock.removeObject).toHaveBeenCalledWith('org-1/file-1/v1');
    expect(minioServiceMock.removeObject).toHaveBeenCalledWith('org-1/file-1/v2');
  });
});

describe('FilesController.upload - MAJOR fix 2 (audit round 25/07/2026): validate folderId truoc khi xuong service', () => {
  function buildController() {
    const filesServiceMock = { upload: jest.fn().mockResolvedValue({ id: 'file-1' }) };
    const controller = new FilesController(filesServiceMock as never);
    return { controller, filesServiceMock };
  }

  const organizationId = 'org-1';
  const actorId = 'actor-1';
  const file = buildMulterFile();

  it('nem BadRequestException (map ve 400) VA KHONG goi xuong service khi folderId khong phai UUID hop le', () => {
    const { controller, filesServiceMock } = buildController();

    expect(() => controller.upload(organizationId, actorId, null, [], file, 'khong-phai-uuid')).toThrow(
      BadRequestException,
    );
    expect(filesServiceMock.upload).not.toHaveBeenCalled();
  });

  it('cho qua va goi xuong service dung gia tri khi folderId la UUID hop le', () => {
    const { controller, filesServiceMock } = buildController();
    const validUuid = '11111111-1111-4111-8111-111111111111';

    controller.upload(organizationId, actorId, null, [], file, validUuid);

    expect(filesServiceMock.upload).toHaveBeenCalledWith(organizationId, actorId, validUuid, file, {
      userId: actorId,
      departmentId: null,
      isOrgAdmin: false,
      // 26/10/2026: toAccessContext() them co Manager theo phong ban (tai lieu theo pham vi du an).
      isDepartmentManager: false,
    });
  });

  it('cho qua khi folderId rong/undefined (quy uoc hop le "tai len thu muc goc"), khong nem loi', () => {
    const { controller, filesServiceMock } = buildController();

    controller.upload(organizationId, actorId, null, [], file, undefined);

    expect(filesServiceMock.upload).toHaveBeenCalledWith(organizationId, actorId, null, file, expect.anything());
  });
});

// 24/10/2026: FileShare permission VIEW/EDIT truoc day chi duoc luu ma khong kiem tra - nguoi chi duoc
// chia se VIEW (khong xem duoc thu muc chua file) van tai phien ban moi, xoa, hoac tu nang quyen chia
// se len EDIT. Thao tac ghi gio chi chap nhan FileShare truc tiep co permission = EDIT.
describe('FilesService - FileShare VIEW chi cho xem, EDIT moi duoc ghi (24/10/2026)', () => {
  const organizationId = 'org-1';
  const fileId = 'file-1';
  const viewerCtx: AccessContext = { userId: 'viewer-1', departmentId: 'dept-1', isOrgAdmin: false };
  const fileInRestrictedFolder = { id: fileId, organizationId, folderId: 'folder-1', fileName: 'hop-dong.pdf' };

  // Gia lap CSDL FileShare: viewer-1 chi co 1 dong share quyen `sharePermission` - findOne tra ve
  // dong do CHI KHI dieu kien where (neu co loc permission) khop.
  function buildService(sharePermission: 'VIEW' | 'EDIT') {
    const share = { id: 'share-1', fileId, sharedWithUserId: 'viewer-1', permission: sharePermission };
    const fileShareRepoMock = {
      findOne: jest.fn(({ where }: { where: Array<Record<string, unknown>> }) =>
        Promise.resolve(where.some((w) => w.sharedWithUserId === 'viewer-1' && (!w.permission || w.permission === share.permission)) ? share : null),
      ),
    };
    const service = new FilesService(
      { transaction: jest.fn().mockRejectedValue(new Error('khong duoc toi transaction')) } as never,
      { findOne: jest.fn().mockResolvedValue(fileInRestrictedFolder) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      fileShareRepoMock as never,
      { findOne: jest.fn().mockResolvedValue({ id: 'folder-1', visibility: FolderVisibility.RESTRICTED, createdByUserId: 'owner-1' }) } as never,
      {} as never,
      { putObject: jest.fn() } as never,
      folderAccessMock(false) as never,
    );
    return { service, fileShareRepoMock };
  }

  it('VIEW: van xem duoc file (findOne)', async () => {
    const { service } = buildService('VIEW');
    await expect(service.findOne(organizationId, fileId, viewerCtx)).resolves.toEqual(expect.objectContaining({ id: fileId }));
  });

  it('VIEW: tai phien ban moi -> ForbiddenException, dieu kien share loc permission = EDIT', async () => {
    const { service, fileShareRepoMock } = buildService('VIEW');
    await expect(
      service.uploadNewVersion(organizationId, 'viewer-1', fileId, buildMulterFile({ originalname: 'hop-dong.pdf' }), viewerCtx),
    ).rejects.toThrow(ForbiddenException);
    const where = fileShareRepoMock.findOne.mock.calls[0][0].where as Array<Record<string, unknown>>;
    expect(where).toHaveLength(2);
    expect(where.every((w) => w.permission === 'EDIT')).toBe(true);
  });

  it('VIEW: tu chia se lai (nang quyen EDIT) -> ForbiddenException', async () => {
    const { service } = buildService('VIEW');
    await expect(
      service.share(organizationId, 'viewer-1', fileId, { sharedWithUserId: 'viewer-1', permission: 'EDIT' } as never, viewerCtx),
    ).rejects.toThrow(ForbiddenException);
  });

  it('VIEW: xoa file -> ForbiddenException', async () => {
    const { service } = buildService('VIEW');
    await expect(service.remove(organizationId, 'viewer-1', fileId, viewerCtx)).rejects.toThrow(ForbiddenException);
  });

  it('EDIT: vuot qua kiem tra quyen ghi (canAccessFile requireEdit = true)', async () => {
    const { service } = buildService('EDIT');
    await expect(service.canAccessFile(organizationId, fileInRestrictedFolder as never, viewerCtx, true)).resolves.toBe(true);
  });
});

// 26/10/2026: tep cap ROOT = tai lieu toan cong ty - ai cung xem, nhung ghi (phien ban moi/chia se/xoa)
// chi Org Admin hoac nguoi duoc chia se EDIT truc tiep. Truoc day Employee tai phien ban moi ghi de
// noi dung tep toan cong ty, Manager xoa duoc tep toan cong ty (da tai hien song).
describe('FilesService.canAccessFile - tep cap ROOT chi Org Admin ghi (26/10/2026)', () => {
  const rootFile = { id: 'file-root', organizationId: 'org-1', folderId: null } as never;
  const employee: AccessContext = { userId: 'emp-1', departmentId: 'dept-1', isOrgAdmin: false };

  function build(share: Record<string, unknown> | null) {
    const fileShareRepoMock = { findOne: jest.fn().mockResolvedValue(share) };
    const folderRepoMock = { findOne: jest.fn() };
    const service = new FilesService(
      { transaction: jest.fn().mockRejectedValue(new Error('khong duoc toi transaction')) } as never,
      { findOne: jest.fn().mockResolvedValue(rootFile) } as never,
      {} as never,
      fileShareRepoMock as never,
      folderRepoMock as never,
      {} as never,
      {} as never,
      { canAccessFolder: jest.fn() } as never,
    );
    return { service, fileShareRepoMock, folderRepoMock };
  }

  it('Employee: xem duoc (khong truy van), ghi -> false; Org Admin ghi duoc', async () => {
    const { service, fileShareRepoMock, folderRepoMock } = build(null);
    await expect(service.canAccessFile('org-1', rootFile, employee)).resolves.toBe(true);
    expect(fileShareRepoMock.findOne).not.toHaveBeenCalled();
    await expect(service.canAccessFile('org-1', rootFile, employee, true)).resolves.toBe(false);
    await expect(service.canAccessFile('org-1', rootFile, { ...employee, isOrgAdmin: true }, true)).resolves.toBe(true);
    expect(folderRepoMock.findOne).not.toHaveBeenCalled();
  });

  it('Employee duoc chia se EDIT truc tiep tren tep ROOT -> ghi duoc (chi chap nhan FileShare EDIT)', async () => {
    const { service, fileShareRepoMock } = build({ id: 'share-1' });
    await expect(service.canAccessFile('org-1', rootFile, employee, true)).resolves.toBe(true);
    expect(fileShareRepoMock.findOne).toHaveBeenCalledWith({
      where: expect.arrayContaining([expect.objectContaining({ fileId: 'file-root', sharedWithUserId: 'emp-1', permission: 'EDIT' })]),
    });
  });

  it('remove(): Employee/Manager tren tep ROOT -> ForbiddenException, khong mo transaction', async () => {
    const { service } = build(null);
    await expect(service.remove('org-1', 'emp-1', 'file-root', employee)).rejects.toThrow(ForbiddenException);
  });
});

// 26/10/2026: tep trong cay toan cong ty (thu muc khong du an) - ai cung xem, ghi chi Org Admin, nguoi duoc
// chia se thu muc (FolderAccessService.writeAccess = 'allowed') hoac FileShare EDIT truc tiep.
describe('FilesService - cay toan cong ty chi Org Admin ghi (26/10/2026)', () => {
  const file = { id: 'file-cw', organizationId: 'org-1', folderId: 'folder-cw' } as never;
  const employee: AccessContext = { userId: 'emp-1', departmentId: 'dept-1', isOrgAdmin: false };

  function build(writeAccess: 'allowed' | 'read-only', share: Record<string, unknown> | null) {
    const folderAccessService = {
      canAccessFolder: jest.fn().mockResolvedValue(true),
      writeAccess: jest.fn().mockResolvedValue(writeAccess),
      assertCanWrite: jest.fn(),
    };
    const service = new FilesService(
      { transaction: jest.fn().mockRejectedValue(new Error('khong duoc toi transaction')) } as never,
      { findOne: jest.fn().mockResolvedValue(file) } as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(share) } as never,
      { findOne: jest.fn().mockResolvedValue({ id: 'folder-cw', organizationId: 'org-1', parentFolderId: null, projectId: null }) } as never,
      {} as never,
      {} as never,
      folderAccessService as never,
    );
    return { service, folderAccessService };
  }

  it('Employee: xem duoc, ghi -> false; quyen ghi lay tu writeAccess cua thu muc chua tep', async () => {
    const { service, folderAccessService } = build('read-only', null);
    await expect(service.canAccessFile('org-1', file, employee)).resolves.toBe(true);
    await expect(service.canAccessFile('org-1', file, employee, true)).resolves.toBe(false);
    expect(folderAccessService.writeAccess).toHaveBeenCalledWith('org-1', 'folder-cw', employee);
    await expect(service.remove('org-1', 'emp-1', 'file-cw', employee)).rejects.toThrow(ForbiddenException);
  });

  it('FileShare EDIT truc tiep hoac duoc chia se thu muc (writeAccess allowed) -> ghi duoc', async () => {
    await expect(build('read-only', { id: 'share-1' }).service.canAccessFile('org-1', file, employee, true)).resolves.toBe(true);
    await expect(build('allowed', null).service.canAccessFile('org-1', file, employee, true)).resolves.toBe(true);
  });
});
