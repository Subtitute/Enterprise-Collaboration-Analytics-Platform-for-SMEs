// 25/07/2026: file moi - test-coverage debt tu dot audit truoc: CHUA co unit test nao khoa lai
// hanh vi "upload()/uploadNewVersion() PHAI goi sanitizeFileName() va
// verifyFileContentMatchesMimeType()" (2 ham bo sung o Fix 1/Fix 4, code review 22/07/2026) - 1
// regression xoa nham 2 loi goi nay se KHONG bi `npm test` phat hien. File nay bo sung dung phan
// con thieu do, cong voi test cho 2 fix MOI trong dot audit nay: MAJOR 1 (ep disposition=attachment
// cho mimeType khong the doi chieu magic-byte trong getDownloadUrl()) va MAJOR 2 (validate folderId
// o FilesController.upload() truoc khi xuong service).
import { BadRequestException } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import * as sanitizeUtil from './utils/sanitize-filename.util';
import * as mimeUtil from './allowed-mime-types';

afterEach(() => {
  jest.restoreAllMocks();
});

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

    const service = new FilesService(
      dataSourceMock as never,
      {} as never,
      {} as never,
      folderRepoMock as never,
      outboxServiceMock as never,
      minioServiceMock as never,
    );
    return { service, managerMock, minioServiceMock, folderRepoMock };
  }

  it('goi CA sanitizeFileName LAN verifyFileContentMatchesMimeType TRUOC khi ghi len MinIO/DB', async () => {
    const sanitizeSpy = jest.spyOn(sanitizeUtil, 'sanitizeFileName');
    const verifySpy = jest.spyOn(mimeUtil, 'verifyFileContentMatchesMimeType');
    const { service, minioServiceMock } = buildService();
    const file = buildMulterFile();

    await service.upload(organizationId, actorId, null, file);

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

    await expect(service.upload(organizationId, actorId, null, file)).rejects.toThrow(BadRequestException);
    expect(minioServiceMock.putObject).not.toHaveBeenCalled();
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

    const service = new FilesService(
      dataSourceMock as never,
      {} as never,
      {} as never,
      {} as never,
      outboxServiceMock as never,
      minioServiceMock as never,
    );
    return { service, managerMock, minioServiceMock };
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

    const result = await service.uploadNewVersion(organizationId, actorId, fileId, file);

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

    await expect(service.uploadNewVersion(organizationId, actorId, fileId, file)).rejects.toThrow(
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
    const service = new FilesService(
      {} as never,
      fileMetaRepoMock as never,
      {} as never,
      {} as never,
      {} as never,
      minioServiceMock as never,
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

    await service.getDownloadUrl(organizationId, fileId, 'inline');

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

    await service.getDownloadUrl(organizationId, fileId, 'inline');

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

    await service.getDownloadUrl(organizationId, fileId, 'inline');

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

    await service.getDownloadUrl(organizationId, fileId);

    const respHeaders = minioServiceMock.presignedGetObject.mock.calls[0][2];
    expect(respHeaders['response-content-disposition']).toMatch(/^attachment;/);
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

    expect(() => controller.upload(organizationId, actorId, file, 'khong-phai-uuid')).toThrow(
      BadRequestException,
    );
    expect(filesServiceMock.upload).not.toHaveBeenCalled();
  });

  it('cho qua va goi xuong service dung gia tri khi folderId la UUID hop le', () => {
    const { controller, filesServiceMock } = buildController();
    const validUuid = '11111111-1111-4111-8111-111111111111';

    controller.upload(organizationId, actorId, file, validUuid);

    expect(filesServiceMock.upload).toHaveBeenCalledWith(organizationId, actorId, validUuid, file);
  });

  it('cho qua khi folderId rong/undefined (quy uoc hop le "tai len thu muc goc"), khong nem loi', () => {
    const { controller, filesServiceMock } = buildController();

    controller.upload(organizationId, actorId, file, undefined);

    expect(filesServiceMock.upload).toHaveBeenCalledWith(organizationId, actorId, null, file);
  });
});
