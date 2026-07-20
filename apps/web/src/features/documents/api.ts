import { apiClient } from '@/lib/api-client';
import type { FileItem, Folder, PaginatedResponse } from '@/types';

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
