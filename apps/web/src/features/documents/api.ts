import { apiClient } from '@/lib/api-client';
import { t } from '@/i18n';
import { formatBytes, unwrapList } from '@/lib/utils';
// 28/07/2026: them FolderShare - kieu du lieu cho cac ham fetchFolderShares/createFolderShare
// moi them ben duoi (tinh nang kiem soat truy cap thu muc theo cap do).
import type { FileItem, FileVersion, Folder, FolderShare, PaginatedResponse } from '@/types';

// 22/07/2026: sua loi thuc te phat hien qua kiem thu that - trang Tai lieu van khong hien
// thu muc/tep du API tra ve du lieu dung (da xac minh qua curl truc tiep Gateway). Nguyen nhan:
// contract cua Document Service dung ten field KHAC voi model FE (Folder/FileItem o @/types):
//   Backend Folder.parentFolderId  <-> FE Folder.parentId
//   Backend FileMeta.fileName/sizeBytes/currentVersion <-> FE FileItem.name/size/version
// Truoc ban sua nay, FE doc thang response tho nen `folder.parentId`/`file.name`... luon la
// undefined - thu muc con/breadcrumb khong bao giu khop (moi thu muc bi coi nhu la goc), va
// bang tep hien ten/kich thuoc rong. Chuan hoa tai 1 lop duy nhat (api.ts) - giu nguyen cac
// component (FolderGrid, FileTable, VersionHistoryModal...) lam viec voi model FE sach, giong
// pattern unwrapList() da dung cho hinh dang response bao ngoai.
interface RawFolder {
  id: string;
  name: string;
  parentFolderId?: string | null;
  // 28/07/2026: 2 truong moi tu backend (tinh nang kiem soat truy cap thu muc theo cap do) - khai
  // bao optional theo dung quy uoc phong thu cua file nay (xem ghi chu dau file) de FE khong vo
  // neu ban dau trien khai backend con thieu/lech ten truong; mapFolder() ben duoi co fallback.
  visibility?: 'organization' | 'restricted';
  createdByUserId?: string;
  // 26/10/2026: tai lieu theo pham vi du an - du an cua thu muc cap goc (null = toan cong ty).
  projectId?: string | null;
  // 26/10/2026: quyen GHI cua nguoi goi (FolderAccessService.resolveFolderWrite) - xem writeAccess.ts.
  canWrite?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function mapFolder(raw: RawFolder): Folder {
  return {
    id: raw.id,
    name: raw.name,
    parentId: raw.parentFolderId ?? null,
    // 28/07/2026: fallback 'organization'/'' neu backend chua/khong tra ve (xem ghi chu tai
    // RawFolder) - mac dinh coi la thu muc mo cho ca to chuc (hanh vi cu truoc tinh nang nay).
    visibility: raw.visibility ?? 'organization',
    createdByUserId: raw.createdByUserId ?? '',
    projectId: raw.projectId ?? null,
    canWrite: raw.canWrite,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

interface RawFileVersion {
  id: string;
  versionNumber: number;
  sizeBytes?: number;
  createdAt: string;
}

function mapFileVersion(raw: RawFileVersion): FileVersion {
  return {
    id: raw.id,
    version: raw.versionNumber,
    size: raw.sizeBytes,
    createdAt: raw.createdAt,
  };
}

interface RawFileMeta {
  id: string;
  fileName: string;
  folderId: string | null;
  sizeBytes?: number;
  mimeType?: string;
  currentVersion?: number;
  uploadedByUserId?: string;
  versions?: RawFileVersion[];
  // 26/10/2026: quyen GHI cua nguoi goi tren tep (FilesService.withWriteFlags) - xem writeAccess.ts.
  canWrite?: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapFile(raw: RawFileMeta): FileItem {
  return {
    id: raw.id,
    name: raw.fileName,
    folderId: raw.folderId,
    size: raw.sizeBytes,
    mimeType: raw.mimeType,
    version: raw.currentVersion,
    uploadedBy: raw.uploadedByUserId,
    versions: raw.versions?.map(mapFileVersion),
    canWrite: raw.canWrite,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

// QUAN TRONG: mang nay PHAI khop byte-for-byte voi allowlist server (Document Service -
// apps/document-service/src/files/allowed-mime-types.ts) - dong bo thu cong theo dung danh sach
// da thong nhat trong dot code review 21/07/2026 de FE bao loi tuc thi thay vi doi response 400.
export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/gif',
  'text/csv',
  'text/plain',
  'application/zip',
] as const;

/** Phai khop MAX_UPLOAD_SIZE_BYTES o files.controller.ts (Document Service): 25 * 1024 * 1024. */
export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

/** Validate file truoc khi upload (client-side, phan hoi tuc thi) - server van la noi thuc thi
 *  that su (Technical_Spec.md muc 9). Tra ve null neu hop le, nguoc lai tra ve thong diep loi. */
export function validateUploadFile(file: File): string | null {
  if (!(ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
    return t('documents:api.unsupportedFileType');
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return t('documents:api.fileTooLarge', { maxSize: formatBytes(MAX_UPLOAD_SIZE_BYTES) });
  }
  return null;
}

// Ghi chu: contract chi neu "GET/POST /folders" (khong co filter parentId ro rang), trong khi
// files thi neu ro "GET /files?folderId=". Vi vay: folders duoc lay TOAN BO 1 lan roi dung
// parentId de dung cay/breadcrumb phia client; files thi loc theo folderId qua query param
// (truyen '' khi dang o thu muc goc, dung theo dung ky hieu "folderId=" trong contract).
// 22/07/2026: sua loi thuc te - GET /folders (FoldersController.findAll) tra ve MANG THO
// (Folder[]), KHONG boc trong { data, meta } nhu gia dinh ban dau (endpoint nay khong dung
// PaginationQueryDto, xem apps/document-service/src/folders/folders.controller.ts). `data.data`
// tren 1 mang thuan la `undefined`, khien cay thu muc/breadcrumb luon trong. Dung unwrapList
// (da dung o cac api.ts khac trong repo) de chuan hoa ca 2 dang response.
export async function fetchFolders(): Promise<Folder[]> {
  const { data } = await apiClient.get<RawFolder[] | PaginatedResponse<RawFolder>>('/folders', { params: { limit: 500 } });
  return unwrapList<RawFolder>(data).map(mapFolder);
}

// 26/10/2026: them projectId - bat buoc voi thu muc cap goc cua Employee/Manager, bo trong = toan
// cong ty (chi Org Admin); thu muc con khong gui (ke thua thu muc cha).
export async function createFolder(payload: { name: string; parentId?: string | null; projectId?: string | null }): Promise<Folder> {
  const { data } = await apiClient.post<RawFolder>('/folders', {
    name: payload.name,
    parentFolderId: payload.parentId ?? undefined,
    projectId: payload.projectId ?? undefined,
  });
  return mapFolder(data);
}

// 26/10/2026: doi du an cua thu muc cap goc (null = chuyen thanh toan cong ty, chi Org Admin).
export async function updateFolderProject(id: string, projectId: string | null): Promise<Folder> {
  const { data } = await apiClient.patch<RawFolder>(`/folders/${id}`, { projectId });
  return mapFolder(data);
}

// 26/10/2026: du an nguoi dung gan/xem duoc tai lieu - bo chon du an chi liet ke dung tap nay.
export async function fetchAccessibleProjectIds(): Promise<string[]> {
  const { data } = await apiClient.get<{ projectIds: string[] }>('/folders/accessible-projects');
  return data.projectIds ?? [];
}

// 26/10/2026: tep cua 1 du an (moi thu muc thuoc du an ma nguoi dung xem duoc) - muc "Tai lieu" o
// trang chi tiet du an.
export async function fetchProjectFiles(projectId: string): Promise<FileItem[]> {
  const { data } = await apiClient.get<PaginatedResponse<RawFileMeta>>('/files', { params: { projectId, limit: 50 } });
  return data.data.map(mapFile);
}

export async function renameFolder(id: string, name: string): Promise<Folder> {
  const { data } = await apiClient.patch<RawFolder>(`/folders/${id}`, { name });
  return mapFolder(data);
}

export async function deleteFolder(id: string): Promise<void> {
  await apiClient.delete(`/folders/${id}`);
}

// 28/07/2026: PATCH /folders/:id gio nhan them "visibility" (tinh nang kiem soat truy cap thu
// muc theo cap do) - tach rieng ham nay voi renameFolder() de goi API ro rang tung muc dich, phuc
// vu muc "Han che truy cap"/"Mo cho ca to chuc" tren dropdown cua FolderGrid.tsx.
export async function updateFolderVisibility(id: string, visibility: 'organization' | 'restricted'): Promise<Folder> {
  const { data } = await apiClient.patch<RawFolder>(`/folders/${id}`, { visibility });
  return mapFolder(data);
}

// 28/07/2026: POST /folders/:id/shares - luon gui dung 1 trong 2 truong sharedWithUserId HOAC
// sharedWithDepartmentId theo dung contract; FolderShareModal.tsx la noi quyet dinh gui truong
// nao tuy theo lua chon "Người dùng"/"Phòng ban" cua nguoi dung.
export async function createFolderShare(
  folderId: string,
  payload: { sharedWithUserId?: string } | { sharedWithDepartmentId?: string },
): Promise<FolderShare> {
  const { data } = await apiClient.post<FolderShare>(`/folders/${folderId}/shares`, payload);
  return data;
}

// 28/07/2026: GET /folders/:id/shares - dung unwrapList() (cung ly do phong thu nhu fetchFolders()
// o tren) phong truong hop response bi boc trong { data, meta } thay vi mang tho.
export async function fetchFolderShares(folderId: string): Promise<FolderShare[]> {
  const { data } = await apiClient.get<FolderShare[] | PaginatedResponse<FolderShare>>(`/folders/${folderId}/shares`, {
    params: { limit: 200 },
  });
  return unwrapList<FolderShare>(data);
}

// 28/07/2026: DELETE /folders/:id/shares/:shareId - go 1 chia se khoi thu muc restricted, dung
// cho nut "Xoá" tren tung dong trong FolderShareModal.tsx.
export async function deleteFolderShare(folderId: string, shareId: string): Promise<void> {
  await apiClient.delete(`/folders/${folderId}/shares/${shareId}`);
}

export async function fetchFiles(folderId: string | null): Promise<FileItem[]> {
  const { data } = await apiClient.get<PaginatedResponse<RawFileMeta>>('/files', {
    params: { folderId: folderId ?? '', limit: 200 },
  });
  return data.data.map(mapFile);
}

export async function fetchFile(id: string): Promise<FileItem> {
  const { data } = await apiClient.get<RawFileMeta>(`/files/${id}`);
  return mapFile(data);
}

export async function uploadFile(folderId: string | null, file: File, onProgress?: (pct: number) => void): Promise<FileItem> {
  const form = new FormData();
  form.append('file', file);
  if (folderId) form.append('folderId', folderId);
  const { data } = await apiClient.post<RawFileMeta>('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return mapFile(data);
}

export async function uploadNewVersion(fileId: string, file: File, onProgress?: (pct: number) => void): Promise<FileItem> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<RawFileMeta>(`/files/${fileId}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return mapFile(data);
}

// 22/07/2026: them tham so disposition - 'inline' de mo/xem truc tiep tren trinh duyet (PDF,
// anh, text render duoc ngay trong tab moi), 'attachment' (mac dinh) de luon ep hop thoai Luu
// tap tin - khop voi 2 hanh dong rieng biet o FileTable ("Xem tệp" vs "Tải xuống").
export async function getDownloadUrl(fileId: string, disposition: 'inline' | 'attachment' = 'attachment'): Promise<string> {
  const { data } = await apiClient.get<{ downloadUrl: string }>(`/files/${fileId}/download`, { params: { disposition } });
  return data.downloadUrl;
}

// 28/07/2026: POST /files/:id/share gio nhan THEM sharedWithDepartmentId (thay the cho
// sharedWithUserId, dung 1 trong 2) - mo rong chu ky ham de ShareModal.tsx chia se tep duoc ca
// cho phong ban, khong chi tung ca nhan nhu truoc.
export async function shareFile(
  fileId: string,
  payload: { sharedWithUserId?: string; sharedWithDepartmentId?: string; permission: string },
): Promise<void> {
  await apiClient.post(`/files/${fileId}/share`, payload);
}

export async function deleteFile(id: string): Promise<void> {
  await apiClient.delete(`/files/${id}`);
}
