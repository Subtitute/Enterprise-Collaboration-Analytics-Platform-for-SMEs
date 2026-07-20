import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import {
  createFolder,
  deleteFile,
  deleteFolder,
  fetchFile,
  fetchFiles,
  fetchFolders,
  getDownloadUrl,
  renameFolder,
  shareFile,
  uploadFile,
  uploadNewVersion,
} from './api';

export function useFoldersQuery() {
  return useQuery({ queryKey: ['folders'], queryFn: fetchFolders });
}

export function useFilesQuery(folderId: string | null) {
  return useQuery({ queryKey: ['files', folderId], queryFn: () => fetchFiles(folderId) });
}

export function useFileQuery(fileId: string | undefined) {
  return useQuery({ queryKey: ['file', fileId], queryFn: () => fetchFile(fileId as string), enabled: Boolean(fileId) });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; parentId?: string | null }) => createFolder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast.success('Đã tạo thư mục mới');
    },
    onError: (error) => toast.error('Không thể tạo thư mục', extractErrorMessage(error)),
  });
}

export function useRenameFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameFolder(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast.success('Đã đổi tên thư mục');
    },
    onError: (error) => toast.error('Không thể đổi tên thư mục', extractErrorMessage(error)),
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast.success('Đã xoá thư mục');
    },
    onError: (error) => toast.error('Không thể xoá thư mục', extractErrorMessage(error)),
  });
}

export function useUploadFile(folderId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (pct: number) => void }) => uploadFile(folderId, file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', folderId] });
      toast.success('Tải lên thành công');
    },
    onError: (error) => toast.error('Tải lên thất bại', extractErrorMessage(error)),
  });
}

export function useUploadNewVersion(fileId: string, folderId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (pct: number) => void }) => uploadNewVersion(fileId, file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', folderId] });
      queryClient.invalidateQueries({ queryKey: ['file', fileId] });
      toast.success('Đã tải lên phiên bản mới');
    },
    onError: (error) => toast.error('Không thể tải lên phiên bản mới', extractErrorMessage(error)),
  });
}

export function useShareFile() {
  return useMutation({
    mutationFn: ({ fileId, sharedWithUserId, permission }: { fileId: string; sharedWithUserId: string; permission: string }) =>
      shareFile(fileId, { sharedWithUserId, permission }),
    onSuccess: () => toast.success('Đã chia sẻ tệp'),
    onError: (error) => toast.error('Không thể chia sẻ tệp', extractErrorMessage(error)),
  });
}

export function useDeleteFile(folderId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', folderId] });
      toast.success('Đã xoá tệp');
    },
    onError: (error) => toast.error('Không thể xoá tệp', extractErrorMessage(error)),
  });
}

export function useDownloadFile() {
  return useMutation({
    mutationFn: (fileId: string) => getDownloadUrl(fileId),
    onSuccess: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    onError: (error) => toast.error('Không thể tải xuống tệp', extractErrorMessage(error)),
  });
}
