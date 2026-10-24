// 24/10/2026: unit test index tai lieu cho RAG (document-indexer.service.ts) - mock DataSource/MinIO/
// Gemini, khong goi DB/API that.
import {
  DocumentIndexerService,
  MAX_CHUNKS_PER_FILE,
  MAX_EXTRACTED_CHARS,
  MAX_INDEXABLE_FILE_BYTES,
  PendingFile,
} from './document-indexer.service';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { GeminiEmbeddingError } from './gemini-embedding.service';

jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockRejectedValue(new Error('Could not find main document part.')),
}));

function pendingFile(overrides: Partial<PendingFile> = {}): PendingFile {
  return {
    id: 'file-1',
    organizationId: 'org-1',
    fileName: 'Quy-dinh.txt',
    mimeType: 'text/plain',
    sizeBytes: '120',
    objectKey: 'org-1/file-1/v1/Quy-dinh.txt',
    currentVersion: 1,
    ...overrides,
  };
}

function buildService(options: { pending?: PendingFile[]; lockedVersion?: number | null; enabled?: boolean } = {}) {
  const manager = {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT current_version')) {
        return Promise.resolve(options.lockedVersion === null ? [] : [{ current_version: options.lockedVersion ?? 1 }]);
      }
      return Promise.resolve([]);
    }),
    delete: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockResolvedValue(undefined),
  };
  const dataSource = {
    // 24/10/2026: cau quet file cho tra ve danh sach cho; cac UPDATE co "dang trich" tra ve rong.
    query: jest.fn((sql: string, _params?: unknown[]) => Promise.resolve(sql.includes('IS DISTINCT FROM') ? (options.pending ?? []) : [])),
    transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const minioService = {
    getObjectBuffer: jest.fn().mockResolvedValue(Buffer.from('Nhân viên được làm việc từ xa tối đa 2 ngày mỗi tuần.', 'utf8')),
  };
  const embeddingService = {
    isEnabled: jest.fn().mockReturnValue(options.enabled ?? true),
    embedDocuments: jest.fn().mockImplementation((texts: string[]) => Promise.resolve(texts.map(() => [0.6, 0.8]))),
  };
  const service = new DocumentIndexerService(dataSource as never, minioService as never, embeddingService as never);
  return { service, dataSource, manager, minioService, embeddingService };
}

/** Tham so cua cac lan quet file cho index (bo qua UPDATE co "dang trich"). */
function scanCalls(dataSource: { query: jest.Mock }): unknown[] {
  return dataSource.query.mock.calls.filter(([sql]) => String(sql).includes('IS DISTINCT FROM')).map(([, params]) => params);
}

describe('DocumentIndexerService.indexFile', () => {
  it('file van ban: tai MinIO -> chia doan -> nhung kem ten file -> thay the chunk + danh dau phien ban', async () => {
    const { service, manager, minioService, embeddingService } = buildService();
    const count = await service.indexFile(pendingFile());

    expect(count).toBe(1);
    expect(minioService.getObjectBuffer).toHaveBeenCalledWith('org-1/file-1/v1/Quy-dinh.txt', MAX_INDEXABLE_FILE_BYTES);
    expect(embeddingService.embedDocuments).toHaveBeenCalledWith(['Nhân viên được làm việc từ xa tối đa 2 ngày mỗi tuần.'], 'Quy-dinh.txt');
    expect(manager.delete).toHaveBeenCalledWith(DocumentChunk, { fileId: 'file-1' });
    expect(manager.insert).toHaveBeenCalledWith(DocumentChunk, [
      expect.objectContaining({ organizationId: 'org-1', fileId: 'file-1', chunkIndex: 0, embedding: [0.6, 0.8] }),
    ]);
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('SET rag_indexed_version'), [1, 'file-1']);
  });

  it('loai file khong ho tro (anh): KHONG tai MinIO/goi Gemini, van xoa chunk cu + danh dau da index', async () => {
    const { service, manager, minioService, embeddingService } = buildService();
    const count = await service.indexFile(pendingFile({ mimeType: 'image/png' }));

    expect(count).toBe(0);
    expect(minioService.getObjectBuffer).not.toHaveBeenCalled();
    expect(embeddingService.embedDocuments).not.toHaveBeenCalled();
    expect(manager.delete).toHaveBeenCalled();
    expect(manager.insert).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('SET rag_indexed_version'), [1, 'file-1']);
  });

  it('file vuot tran kich thuoc index: bo qua noi dung (khong tai ve)', async () => {
    const { service, minioService } = buildService();
    await service.indexFile(pendingFile({ sizeBytes: String(MAX_INDEXABLE_FILE_BYTES + 1) }));
    expect(minioService.getObjectBuffer).not.toHaveBeenCalled();
  });

  it('file da sang phien ban moi trong luc xu ly: bo ket qua cu, khong ghi chunk', async () => {
    const { service, manager } = buildService({ lockedVersion: 2 });
    await expect(service.indexFile(pendingFile())).resolves.toBeNull();
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.insert).not.toHaveBeenCalled();
  });

  // 24/10/2026 (fix kiem thu RAG): PDF/DOCX hong -> danh dau da index (0 doan), khong thu lai mai.
  it('PDF/DOCX hong: KHONG nem loi, khong goi Gemini, van danh dau da index phien ban nay', async () => {
    const { service, manager, minioService, embeddingService } = buildService();
    minioService.getObjectBuffer.mockResolvedValueOnce(Buffer.from('PK khong phai docx'));
    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    await expect(service.indexFile(pendingFile({ mimeType: docx }))).resolves.toBe(0);
    expect(embeddingService.embedDocuments).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('SET rag_indexed_version'), [1, 'file-1']);
  });

  it('chi trich toi da MAX_EXTRACTED_CHARS ky tu va MAX_CHUNKS_PER_FILE doan', async () => {
    const { service, minioService, embeddingService } = buildService();
    minioService.getObjectBuffer.mockResolvedValueOnce(Buffer.from('Doan van kiem thu kho hang. '.repeat(20_000)));

    await expect(service.indexFile(pendingFile())).resolves.toBe(MAX_CHUNKS_PER_FILE);
    const [chunks] = embeddingService.embedDocuments.mock.calls[0] as [string[]];
    expect(chunks.join('').length).toBeLessThanOrEqual(MAX_EXTRACTED_CHARS);
  });

  // 24/10/2026: co "dang trich" - chong vong lap crash-restart khi trich van ban lam chet process (OOM).
  it('dat co "dang trich" SAU khi tai xong, xoa co trong finally (ke ca khi trich loi)', async () => {
    const { service, dataSource } = buildService();
    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    await service.indexFile(pendingFile({ mimeType: docx }));

    const updates = dataSource.query.mock.calls.filter(([sql]) => String(sql).includes('rag_extract_attempt_version'));
    expect(updates.map(([, params]) => params)).toEqual([
      [1, 'file-1'],
      [null, 'file-1'],
    ]);
  });

  it('co "dang trich" con nguyen cho CHINH phien ban nay (process chet lan truoc) -> khong tai/trich lai, danh dau da index', async () => {
    const { service, manager, minioService, embeddingService } = buildService();
    await expect(service.indexFile(pendingFile({ extractAttemptVersion: 1 }))).resolves.toBe(0);

    expect(minioService.getObjectBuffer).not.toHaveBeenCalled();
    expect(embeddingService.embedDocuments).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('rag_extract_attempt_version = NULL'), [1, 'file-1']);
  });

  it('co "dang trich" cua phien ban CU -> phien ban moi van duoc trich binh thuong', async () => {
    const { service, minioService } = buildService({ lockedVersion: 2 });
    await service.indexFile(pendingFile({ currentVersion: 2, extractAttemptVersion: 1 }));
    expect(minioService.getObjectBuffer).toHaveBeenCalled();
  });

  it('file bi xoa trong luc xu ly: bo ket qua', async () => {
    const { service, manager } = buildService({ lockedVersion: null });
    await expect(service.indexFile(pendingFile())).resolves.toBeNull();
    expect(manager.insert).not.toHaveBeenCalled();
  });
});

describe('DocumentIndexerService.indexPendingFiles', () => {
  it('RAG tat (khong co GEMINI_API_KEY): khong quet gi', async () => {
    const { service, dataSource } = buildService({ enabled: false });
    await service.indexPendingFiles();
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('file loi: KHONG nem loi ra ngoai, va bi loai khoi lan quet ke tiep (lui lich thu lai)', async () => {
    const { service, dataSource, embeddingService } = buildService({ pending: [pendingFile()] });
    embeddingService.embedDocuments.mockRejectedValueOnce(new Error('HTTP 429'));

    await expect(service.indexPendingFiles()).resolves.toBeUndefined();
    await service.indexPendingFiles();

    expect(scanCalls(dataSource)).toEqual([[[], 3], [['file-1'], 3]]);
  });

  // 24/10/2026 (fix kiem thu RAG): key sai/het han ngach -> dung CA vong, khong goi tiep cho file khac.
  it('loi cap dich vu Gemini (429/key sai): dung ca vong + tam dung, khong lui lich rieng file', async () => {
    const { service, dataSource, embeddingService } = buildService({
      pending: [pendingFile(), pendingFile({ id: 'file-2' }), pendingFile({ id: 'file-3' })],
    });
    embeddingService.embedDocuments.mockRejectedValueOnce(new GeminiEmbeddingError('HTTP 429', true));

    await service.indexPendingFiles();
    expect(embeddingService.embedDocuments).toHaveBeenCalledTimes(1);

    await service.indexPendingFiles();
    expect(scanCalls(dataSource)).toHaveLength(1);

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    await service.indexPendingFiles();
    jest.restoreAllMocks();
    expect(scanCalls(dataSource)[1]).toEqual([[], 3]);
  });
});
