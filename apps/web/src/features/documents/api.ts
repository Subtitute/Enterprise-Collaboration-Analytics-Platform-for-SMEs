import { apiClient } from '@/lib/api-client';
import { formatBytes } from '@/lib/utils';
import type { FileItem, Folder, PaginatedResponse } from '@/types';

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
    return 'Loại tệp không được hỗ trợ';
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return `Tệp vượt quá kích thước cho phép (tối đa ${formatBytes(MAX_UPLOAD_SIZE_BYTES)})`;
  }
  return null;
}

// Ghi chu: contract chi neu "GET/POST /folders" (khong co filter parentId ro rang), trong khi
// files thi neu ro "GET /files?folderId=". Vi vay: folders duoc lay TOAN BO 1 lan roi dung
// parentId de dung cay/breadcrumb phia client; files thi loc theo folderId qua query param
// (truyen '' khi dang o thu muc goc, dung theo dung ky hieu "folderId=" trong contract).
export async function fetchFolders(): Promise<Folder[]> {
  const { data } = await apiClient.get<PaginatedResponse<Folder>>('/folders', { params: { limit: 500 } });
  return data.data;
}

export async function createFolder(payload: { name: string; parentId?: string | null }): Promise<Folder> {
  const { data } = await apiClient.post<Folder>('/folders', payload);
  return data;
}

export async function renameFolder(id: string, name: string): Promise<Folder> {
  const { data } = await apiClient.patch<Folder>(`/folders/${id}`, { name });
  return data;
}

export async function deleteFolder(id: string): Promise<void> {
  await apiClient.delete(`/folders/${id}`);
}

export async function fetchFiles(folderId: string | null): Promise<FileItem[]> {
  const { data } = await apiClient.get<PaginatedResponse<FileItem>>('/files', {
    params: { folderId: folderId ?? '', limit: 200 },
  });
  return data.data;
}

export async function fetchFile(id: string): Promise<FileItem> {
  const { data } = await apiClient.get<FileItem>(`/files/${id}`);
  return data;
}

export async function uploadFile(folderId: string | null, file: File, onProgress?: (pct: number) => void): Promise<FileItem> {
  const form = new FormData();
  form.append('file', file);
  if (folderId) form.append('folderId', folderId);
  const { data } = await apiClient.post<FileItem>('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return data;
}

export async function uploadNewVersion(fileId: string, file: File, onProgress?: (pct: number) => void): Promise<FileItem> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<FileItem>(`/files/${fileId}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return data;
}

export async function getDownloadUrl(fileId: string): Promise<string> {
  const { data } = await apiClient.get<{ downloadUrl: string }>(`/files/${fileId}/download`);
  return data.downloadUrl;
}

export async function shareFile(fileId: string, payload: { sharedWithUserId: string; permission: string }): Promise<void> {
  await apiClient.post(`/files/${fileId}/share`, payload);
}

export async function deleteFile(id: string): Promise<void> {
  await apiClient.delete(`/files/${id}`);
}
