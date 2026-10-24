// 24/10/2026: unit test tim kiem ngu nghia tai lieu (RAG) - trong tam la LOC QUYEN: doan van cua file
// nguoi goi khong xem duoc (theo FilesService.canAccessFile) KHONG BAO GIO duoc nap/cham diem/tra ve.
import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { ERROR_CODES } from '@app/common-dto';
import { DocumentSearchService, MIN_RELEVANCE_SCORE, SEARCH_RATE_LIMIT } from './document-search.service';
import { AccessContext } from '../folders/folder-access.service';

const CTX: AccessContext = { userId: 'user-1', departmentId: 'dept-1', isOrgAdmin: false };

const FILES = [
  { id: 'f-open', fileName: 'Quy-dinh-chung.pdf', folderId: null },
  { id: 'f-restricted', fileName: 'Bang-luong-mat.pdf', folderId: 'folder-secret' },
  { id: 'f-shared', fileName: 'Hop-dong-rieng.docx', folderId: 'folder-secret' },
];

// Doan cua file bi han che GIONG cau hoi nhat (diem cao nhat) - neu loc quyen sai, no se dung dau.
const CHUNKS = [
  { fileId: 'f-open', content: 'Quy dinh lam viec tu xa', embedding: [0.9, 0.1] },
  { fileId: 'f-restricted', content: 'Bang luong thang 10', embedding: [1, 0] },
  { fileId: 'f-shared', content: 'Dieu khoan hop dong', embedding: [0.8, 0.2] },
  { fileId: 'f-open', content: 'Noi dung khong lien quan', embedding: [0, 1] },
];

function buildService(options: { enabled?: boolean; accessible?: string[]; embedError?: boolean } = {}) {
  const accessible = new Set(options.accessible ?? ['f-open', 'f-shared']);
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(FILES.map((f) => ({ fileId: f.id }))),
  };
  const chunkRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    find: jest.fn().mockImplementation(({ where }: { where: { fileId: FindOperator<string[]> } }) => {
      const ids = where.fileId.value as unknown as string[];
      return Promise.resolve(CHUNKS.filter((chunk) => ids.includes(chunk.fileId)));
    }),
  };
  const fileMetaRepo = { find: jest.fn().mockResolvedValue(FILES) };
  // 24/10/2026: search dung bo loc hang loat createFileAccessFilter() (cung quy tac canAccessFile).
  const canAccessFile = jest.fn((file: { id: string }) => accessible.has(file.id));
  const filesService = { createFileAccessFilter: jest.fn().mockResolvedValue(canAccessFile) };
  const embeddingService = {
    isEnabled: jest.fn().mockReturnValue(options.enabled ?? true),
    embedQuery: options.embedError
      ? jest.fn().mockRejectedValue(new Error('HTTP 429'))
      : jest.fn().mockResolvedValue([1, 0]),
  };
  const service = new DocumentSearchService(
    chunkRepo as never,
    fileMetaRepo as never,
    filesService as never,
    embeddingService as never,
  );
  return { service, chunkRepo, filesService, canAccessFile, embeddingService };
}

describe('DocumentSearchService.search', () => {
  it('RAG chua cau hinh -> ket qua rong kem ragEnabled=false, khong truy van gi', async () => {
    const { service, chunkRepo, embeddingService } = buildService({ enabled: false });
    await expect(service.search('org-1', { query: 'nghi phep' }, CTX)).resolves.toEqual({ ragEnabled: false, results: [] });
    expect(chunkRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(embeddingService.embedQuery).not.toHaveBeenCalled();
  });

  it('loc o muc FILE theo canAccessFile TRUOC, chi nap chunk cua file duoc phep', async () => {
    const { service, chunkRepo, filesService, canAccessFile } = buildService();
    const result = await service.search('org-1', { query: 'luong' }, CTX);

    expect(filesService.createFileAccessFilter).toHaveBeenCalledTimes(1);
    expect(filesService.createFileAccessFilter).toHaveBeenCalledWith('org-1', CTX);
    expect(canAccessFile).toHaveBeenCalledTimes(FILES.length);
    expect(canAccessFile).toHaveBeenCalledWith(FILES[1]);
    const loadedIds = (chunkRepo.find.mock.calls[0][0].where.fileId as FindOperator<string[]>).value as unknown as string[];
    expect(loadedIds.sort()).toEqual(['f-open', 'f-shared']);
    expect(result.results.map((r) => r.fileId)).not.toContain('f-restricted');
  });

  it('xep hang theo cosine, gan dung ten file, bo doan duoi nguong lien quan', async () => {
    const { service } = buildService();
    const result = await service.search('org-1', { query: 'tu xa', topK: 5 }, CTX);

    expect(result.ragEnabled).toBe(true);
    expect(result.results.map((r) => r.fileName)).toEqual(['Quy-dinh-chung.pdf', 'Hop-dong-rieng.docx']);
    expect(result.results.every((r) => r.score >= MIN_RELEVANCE_SCORE)).toBe(true);
    expect(result.results[0].content).toBe('Quy dinh lam viec tu xa');
  });

  it('Org Admin/nguoi duoc chia se thay ca file han che (canAccessFile tra true)', async () => {
    const { service } = buildService({ accessible: ['f-open', 'f-restricted', 'f-shared'] });
    const result = await service.search('org-1', { query: 'luong' }, { ...CTX, isOrgAdmin: true });
    expect(result.results[0].fileId).toBe('f-restricted');
  });

  it('khong co file nao xem duoc -> rong, KHONG ton 1 lan goi embedding', async () => {
    const { service, embeddingService, chunkRepo } = buildService({ accessible: [] });
    await expect(service.search('org-1', { query: 'luong' }, CTX)).resolves.toEqual({ ragEnabled: true, results: [] });
    expect(embeddingService.embedQuery).not.toHaveBeenCalled();
    expect(chunkRepo.find).not.toHaveBeenCalled();
  });

  it('loi nhung cau hoi (vd 429) -> 503 voi ma DOCUMENT_SEARCH_UNAVAILABLE', async () => {
    const { service } = buildService({ embedError: true });
    const error = await service.search('org-1', { query: 'luong' }, CTX).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({ errorCode: ERROR_CODES.DOCUMENT_SEARCH_UNAVAILABLE });
  });

  // 24/10/2026: gioi han tan suat theo nguoi dung - bao ve han ngach Gemini dung chung toan nen tang.
  describe('gioi han tan suat theo nguoi dung', () => {
    afterEach(() => jest.useRealTimers());

    it('vuot tran trong cua so -> 429 DOCUMENT_SEARCH_RATE_LIMITED, KHONG goi Gemini them', async () => {
      const { service, embeddingService } = buildService();
      for (let i = 0; i < SEARCH_RATE_LIMIT.maxRequests; i++) {
        await service.search('org-1', { query: 'luong' }, CTX);
      }
      const error = await service.search('org-1', { query: 'luong' }, CTX).catch((err: unknown) => err);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).getResponse()).toMatchObject({ errorCode: ERROR_CODES.DOCUMENT_SEARCH_RATE_LIMITED });
      expect(embeddingService.embedQuery).toHaveBeenCalledTimes(SEARCH_RATE_LIMIT.maxRequests);
    });

    it('dem rieng tung nguoi dung, va het cua so thi duoc goi lai', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-24T10:00:00Z') });
      const { service } = buildService();
      for (let i = 0; i < SEARCH_RATE_LIMIT.maxRequests; i++) {
        await service.search('org-1', { query: 'luong' }, CTX);
      }
      await expect(service.search('org-1', { query: 'luong' }, { ...CTX, userId: 'user-2' })).resolves.toMatchObject({ ragEnabled: true });
      await expect(service.search('org-1', { query: 'luong' }, CTX)).rejects.toBeInstanceOf(HttpException);
      jest.setSystemTime(Date.now() + SEARCH_RATE_LIMIT.windowMs + 1);
      await expect(service.search('org-1', { query: 'luong' }, CTX)).resolves.toMatchObject({ ragEnabled: true });
    });

    it('khong dem lan goi khong ton Gemini (RAG tat / khong co file xem duoc)', async () => {
      const { service, embeddingService } = buildService({ accessible: [] });
      for (let i = 0; i < SEARCH_RATE_LIMIT.maxRequests + 5; i++) {
        await service.search('org-1', { query: 'luong' }, CTX);
      }
      expect(embeddingService.embedQuery).not.toHaveBeenCalled();
    });
  });
});
