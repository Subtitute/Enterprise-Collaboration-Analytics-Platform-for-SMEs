// 26/10/2026: chat bot (RAG search-chunks) phai theo DUNG pham vi du an nhu trang Tai lieu. Test
// noi chuoi THAT FolderAccessService -> FilesService.createFileAccessFilter -> DocumentSearchService
// (chi gia lap repository/Gemini): nhan vien KHONG nhan duoc doan nao cua du an minh khong tham gia,
// du doan do giong cau hoi nhat.
import { FindOperator } from 'typeorm';
import { PERMISSIONS } from '@app/common-dto';
import { DocumentSearchService } from './document-search.service';
import { FilesService } from '../files/files.service';
import { FolderAccessService, GRANTS_SQL, toAccessContext } from '../folders/folder-access.service';
import { FolderVisibility } from '../entities/folder.entity';

const ORG = 'org-1';
const FOLDERS = [
  { id: 'folder-p1', parentFolderId: null, visibility: FolderVisibility.ORGANIZATION, createdByUserId: 'admin', projectId: 'project-1' },
  { id: 'folder-p2', parentFolderId: null, visibility: FolderVisibility.ORGANIZATION, createdByUserId: 'admin', projectId: 'project-2' },
  { id: 'folder-p2-sub', parentFolderId: 'folder-p2', visibility: FolderVisibility.ORGANIZATION, createdByUserId: 'emp-1', projectId: null },
  { id: 'folder-policy', parentFolderId: null, visibility: FolderVisibility.ORGANIZATION, createdByUserId: 'admin', projectId: null },
];
const FILES = [
  { id: 'f-p1', fileName: 'ke-hoach-p1.txt', folderId: 'folder-p1' },
  { id: 'f-p2', fileName: 'hop-dong-p2.txt', folderId: 'folder-p2' },
  { id: 'f-p2-sub', fileName: 'bao-gia-p2.txt', folderId: 'folder-p2-sub' },
  { id: 'f-policy', fileName: 'noi-quy.txt', folderId: 'folder-policy' },
];
// Doan cua du an 2 giong cau hoi NHAT - neu loc quyen sai chung se dung dau ket qua.
const CHUNKS = [
  { fileId: 'f-p2', content: 'Gia tri hop dong du an 2', embedding: [1, 0] },
  { fileId: 'f-p2-sub', content: 'Bao gia du an 2', embedding: [0.99, 0.01] },
  { fileId: 'f-p1', content: 'Ke hoach du an 1', embedding: [0.9, 0.1] },
  { fileId: 'f-policy', content: 'Noi quy cong ty', embedding: [0.85, 0.15] },
];

/** projectIds = du an nguoi goi thuoc pham vi (ket qua GRANTS_SQL gia lap theo dung tham so). */
function buildSearch(grantsFor: (params: unknown[]) => string[]) {
  const folderRepo = {
    find: jest.fn().mockResolvedValue(FOLDERS),
    query: jest.fn((sql: string, params: unknown[]) => {
      expect(sql).toBe(GRANTS_SQL);
      return Promise.resolve(grantsFor(params).map((id) => ({ kind: 'project', id })));
    }),
  };
  const folderAccessService = new FolderAccessService(folderRepo as never, { find: jest.fn() } as never);
  const fileShareRepo = { find: jest.fn().mockResolvedValue([]) };
  const filesService = new FilesService(
    {} as never,
    {} as never,
    {} as never,
    fileShareRepo as never,
    {} as never,
    {} as never,
    {} as never,
    folderAccessService,
  );
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(FILES.map((f) => ({ fileId: f.id }))),
  };
  const chunkRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    find: jest.fn(({ where }: { where: { fileId: FindOperator<string[]> } }) => {
      const ids = where.fileId.value as unknown as string[];
      return Promise.resolve(CHUNKS.filter((chunk) => ids.includes(chunk.fileId)));
    }),
  };
  const fileMetaRepo = { find: jest.fn().mockResolvedValue(FILES) };
  const embeddingService = { isEnabled: () => true, embedQuery: jest.fn().mockResolvedValue([1, 0]) };
  const search = new DocumentSearchService(chunkRepo as never, fileMetaRepo as never, filesService, embeddingService as never);
  return { search, folderRepo, fileShareRepo, chunkRepo };
}

describe('RAG search-chunks theo pham vi du an', () => {
  it('nhan vien chi thuoc du an 1: KHONG nhan doan nao cua du an 2 (ke ca thu muc con do chinh ho tao), van thay tai lieu toan cong ty', async () => {
    const { search, folderRepo, fileShareRepo, chunkRepo } = buildSearch(() => ['project-1']);
    const employee = toAccessContext('emp-1', 'dept-1', [PERMISSIONS.DOCUMENT_VIEW]);

    const result = await search.search(ORG, { query: 'gia tri hop dong', topK: 10 }, employee);
    const fileIds = result.results.map((r) => r.fileId);

    expect(fileIds).not.toContain('f-p2');
    expect(fileIds).not.toContain('f-p2-sub');
    expect(fileIds.sort()).toEqual(['f-p1', 'f-policy']);
    // Doan cua du an 2 tham chi khong duoc nap de cham diem.
    const loaded = (chunkRepo.find.mock.calls[0][0].where.fileId as FindOperator<string[]>).value as unknown as string[];
    expect(loaded.sort()).toEqual(['f-p1', 'f-policy']);
    // So truy van co dinh cho ca lan tim: cay thu muc + 1 cau quyen + FileShare truc tiep.
    expect(folderRepo.find).toHaveBeenCalledTimes(1);
    expect(folderRepo.query).toHaveBeenCalledTimes(1);
    expect(fileShareRepo.find).toHaveBeenCalledTimes(1);
  });

  it('Manager: tham so phong ban chi duoc truyen khi la Manager - du an 2 co nguoi phong ban minh thi thay duoc', async () => {
    const { search } = buildSearch((params) => (params[3] === 'dept-1' ? ['project-1', 'project-2'] : ['project-1']));
    const manager = toAccessContext('mgr-1', 'dept-1', [PERMISSIONS.DOCUMENT_VIEW, PERMISSIONS.PROJECT_CREATE]);

    const result = await search.search(ORG, { query: 'gia tri hop dong', topK: 10 }, manager);
    expect(result.results[0].fileId).toBe('f-p2');
    expect(result.results.map((r) => r.fileId).sort()).toEqual(['f-p1', 'f-p2', 'f-p2-sub', 'f-policy']);
  });

  it('Org Admin: moi doan, khong truy van quyen', async () => {
    const { search, folderRepo } = buildSearch(() => []);
    const admin = toAccessContext('admin', null, [PERMISSIONS.DOCUMENT_VIEW, PERMISSIONS.ORG_MANAGE]);
    const result = await search.search(ORG, { query: 'gia tri hop dong', topK: 10 }, admin);
    expect(result.results).toHaveLength(4);
    expect(folderRepo.query).not.toHaveBeenCalled();
  });
});
