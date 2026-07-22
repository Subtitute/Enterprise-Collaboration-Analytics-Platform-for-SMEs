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

// 22/07/2026: them tham so `options.enabled` (mac dinh khong truyen = giu nguyen hanh vi cu, luon
// bat, vd. DocumentsPage) - can thiet de useGlobalSearch() (Topbar) co the tri hoan query nay toi
// khi nguoi dung thuc su focus o tim kiem, thay vi goi ngay khi Topbar mount o MOI trang.
export function useFoldersQuery(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['folders'], queryFn: fetchFolders, enabled: options?.enabled });
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

// 22/07/2026: sua loi thuc te - "Xem tệp"/"Tải xuống" hau nhu luon bi trinh duyet chan khi bat
// popup blocker. Ban goc goi window.open(url) BEN TRONG onSuccess cua mutation, tuc SAU khi
// await getDownloadUrl() (1 network call) hoan tat - luc do code da chay NGOAI pham vi "user
// gesture" dong bo (click) ma hau het trinh duyet doi hoi de cho phep mo tab/popup moi, nen
// window.open bi am tham chan va khong co loi/thong bao nao hien len cho nguoi dung thay. Sua
// bang cach tra ve ham `openFile` duoc goi TRUC TIEP, DONG BO ngay trong onClick (truoc ca khi
// biet URL that) - mo san 1 tab trong ("about:blank") ngay trong gesture, roi khi mutation tra
// ve URL that thi chi gan lai `tab.location.href` cua tab da mo san (khong goi window.open lan
// 2 => khong con bi chan). Neu ngay ca tab trong cung bi chan (vd. trinh duyet khong coi click
// nay la gesture hop le), fallback ve dung hanh vi cu (best-effort) kem toast bao cho nguoi dung.
export function useDownloadFile() {
  const mutation = useMutation({
    mutationFn: ({ fileId, disposition = 'attachment' }: { fileId: string; disposition?: 'inline' | 'attachment' }) =>
      getDownloadUrl(fileId, disposition),
  });

  const openFile = (fileId: string, disposition: 'inline' | 'attachment' = 'attachment') => {
    const tab = window.open('', '_blank', 'noopener,noreferrer');
    if (!tab) {
      toast.info('Cửa sổ mới có thể đã bị trình duyệt chặn', 'Vui lòng cho phép cửa sổ bật lên (pop-up) cho trang này rồi thử lại.');
    }
    mutation.mutate(
      { fileId, disposition },
      {
        onSuccess: (url) => {
          if (tab) {
            tab.location.href = url;
          } else {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        },
        onError: (error) => {
          tab?.close();
          toast.error(disposition === 'inline' ? 'Không thể mở tệp' : 'Không thể tải xuống tệp', extractErrorMessage(error));
        },
      },
    );
  };

  return { ...mutation, openFile };
}
