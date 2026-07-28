import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import {
  createFolder,
  // 28/07/2026: cac ham API moi cho tinh nang kiem soat truy cap thu muc theo cap do (visibility +
  // quan ly chia se) - xem ghi chu chi tiet tung ham tai api.ts.
  createFolderShare,
  deleteFile,
  deleteFolder,
  deleteFolderShare,
  fetchFile,
  fetchFiles,
  fetchFolders,
  fetchFolderShares,
  getDownloadUrl,
  renameFolder,
  shareFile,
  updateFolderVisibility,
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

// 28/07/2026: hook cho PATCH /folders/:id { visibility } - tach rieng voi useRenameFolder() de
// FolderGrid.tsx goi ro rang tung muc dich; giu nguyen quy uoc invalidate ['folders'] + toast nhu
// cac mutation thu muc khac o tren.
export function useUpdateFolderVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, visibility }: { id: string; visibility: 'organization' | 'restricted' }) => updateFolderVisibility(id, visibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast.success('Đã cập nhật quyền truy cập thư mục');
    },
    onError: (error) => toast.error('Không thể cập nhật quyền truy cập thư mục', extractErrorMessage(error)),
  });
}

// 28/07/2026: hook cho GET /folders/:id/shares - dung trong FolderShareModal.tsx de hien danh sach
// da chia se; `enabled: Boolean(folderId)` giong quy uoc useFileQuery() o tren (chi goi khi da co
// id, tranh goi voi id rong luc modal chua mo/folder=null).
export function useFolderSharesQuery(folderId: string | undefined) {
  return useQuery({
    queryKey: ['folder-shares', folderId],
    queryFn: () => fetchFolderShares(folderId as string),
    enabled: Boolean(folderId),
  });
}

// 28/07/2026: hook cho POST /folders/:id/shares - invalidate dung ['folder-shares', folderId]
// (khoa query cua useFolderSharesQuery() ngay tren) de danh sach trong modal cap nhat ngay sau
// khi them 1 chia se moi.
export function useCreateFolderShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      folderId,
      payload,
    }: {
      folderId: string;
      payload: { sharedWithUserId?: string } | { sharedWithDepartmentId?: string };
    }) => createFolderShare(folderId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['folder-shares', variables.folderId] });
      toast.success('Đã chia sẻ thư mục');
    },
    onError: (error) => toast.error('Không thể chia sẻ thư mục', extractErrorMessage(error)),
  });
}

// 28/07/2026: hook cho DELETE /folders/:id/shares/:shareId - dung cho nut "Xoá" tren tung dong
// chia se trong FolderShareModal.tsx.
export function useDeleteFolderShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ folderId, shareId }: { folderId: string; shareId: string }) => deleteFolderShare(folderId, shareId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['folder-shares', variables.folderId] });
      toast.success('Đã xoá chia sẻ');
    },
    onError: (error) => toast.error('Không thể xoá chia sẻ', extractErrorMessage(error)),
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

// 28/07/2026: mo rong tham so - nhan THEM sharedWithDepartmentId (song song sharedWithUserId, chi
// truyen 1 trong 2) de ShareModal.tsx chia se tep duoc ca cho phong ban, khop voi chu ky moi cua
// shareFile() (api.ts).
export function useShareFile() {
  return useMutation({
    mutationFn: ({
      fileId,
      sharedWithUserId,
      sharedWithDepartmentId,
      permission,
    }: {
      fileId: string;
      sharedWithUserId?: string;
      sharedWithDepartmentId?: string;
      permission: string;
    }) => shareFile(fileId, { sharedWithUserId, sharedWithDepartmentId, permission }),
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
    // 28/07/2026: sua loi thuc te phat hien qua E2E test (Playwright, trinh duyet That) - lan sua
    // 22/07/2026 truyen "noopener" ngay o LAN GOI window.open() DAU TIEN (mo tab trong). Theo dung
    // dac ta WHATWG HTML, khi co "noopener" (hoac "noreferrer", von ke ham "noopener"), trinh duyet
    // KHONG bao gio tra ve tham chieu toi cua so moi - ham window.open() luon tra ve `null` trong
    // truong hop nay (day la hanh vi DUNG dac ta, khong phai loi trinh duyet/moi truong kiem thu).
    // Ket qua: bien `tab` luon la null, nhanh `if (!tab)` luon dung (hien nham toast "co the da bi
    // chan" ke ca khi tab mo thanh cong), va code luon roi vao nhanh else goi window.open(url,...)
    // lan 2 SAU KHI mutation bat dong bo hoan tat - dung LA loi "mo tab ngoai pham vi user gesture"
    // ma ban sua 22/07/2026 dinh loai bo tu dau, khien toan bo ban sua do vo hieu tu luc viet ra.
    // Sua dung cach: mo tab KHONG kem "noopener/noreferrer" de nhan duoc tham chieu that, roi tu
    // gan `tab.opener = null` ngay sau do - dat duoc CUNG muc tieu chong "reverse tabnabbing" (tab
    // moi khong the dung window.opener de thao tung tab goc) ma khong lam mat tham chieu can thiet
    // de dieu huong tab do sau khi co URL that.
    const tab = window.open('', '_blank');
    if (tab) {
      tab.opener = null;
    } else {
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
