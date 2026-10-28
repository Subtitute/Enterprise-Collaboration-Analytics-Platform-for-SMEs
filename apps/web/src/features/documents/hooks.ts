import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FileItem } from '@/types';
import { toast } from '@/stores/toast.store';
// 26/10/2026: ten du an cho bo chon/nhan du an cua thu muc (tai lieu theo pham vi du an).
import { useProjectsQuery } from '@/features/projects/hooks';
import { extractErrorMessage } from '@/lib/api-client';
import { t } from '@/i18n';
import {
  createFolder,
  // 28/07/2026: cac ham API moi cho tinh nang kiem soat truy cap thu muc theo cap do (visibility +
  // quan ly chia se) - xem ghi chu chi tiet tung ham tai api.ts.
  createFolderShare,
  deleteFile,
  deleteFolder,
  deleteFolderShare,
  fetchAccessibleProjectIds,
  fetchFile,
  fetchFiles,
  fetchFolders,
  fetchFolderShares,
  fetchProjectFiles,
  getDownloadUrl,
  renameFolder,
  shareFile,
  updateFolderProject,
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

// 26/10/2026: tai lieu theo pham vi du an - danh sach du an nguoi dung gan/xem duoc tai lieu (giao
// cua GET /folders/accessible-projects voi ten du an tu GET /projects) va ban do id -> ten cho nhan
// du an tren the thu muc. Du an khong co trong GET /projects (vd chi duoc chia se 1 thu muc) van hien
// nhan chung "Du an khac" thay vi id tho.
export function useDocumentProjects() {
  const accessibleQuery = useQuery({ queryKey: ['folders', 'accessible-projects'], queryFn: fetchAccessibleProjectIds, staleTime: 60_000 });
  const projectsQuery = useProjectsQuery({ limit: 100 });
  const projectNames = useMemo(
    () => new Map((projectsQuery.data?.data ?? []).map((project) => [project.id, project.name])),
    [projectsQuery.data],
  );
  const options = useMemo(
    () =>
      (accessibleQuery.data ?? [])
        .map((id) => ({ id, name: projectNames.get(id) ?? t('documents:projectScope.unknownProject') }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [accessibleQuery.data, projectNames],
  );
  return { options, projectNames, isLoading: accessibleQuery.isLoading || projectsQuery.isLoading };
}

export function useUpdateFolderProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string | null }) => updateFolderProject(id, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['project-files'] });
      toast.success(t('documents:projectScope.updated'));
    },
    onError: (error) => toast.error(t('documents:projectScope.updateError'), extractErrorMessage(error)),
  });
}

export function useProjectFilesQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-files', projectId],
    queryFn: () => fetchProjectFiles(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    // 26/10/2026: them projectId (thu muc cap goc theo du an).
    mutationFn: (payload: { name: string; parentId?: string | null; projectId?: string | null }) => createFolder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast.success(t('documents:hooks.folderCreated'));
    },
    onError: (error) => toast.error(t('documents:hooks.folderCreateError'), extractErrorMessage(error)),
  });
}

export function useRenameFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameFolder(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast.success(t('documents:hooks.folderRenamed'));
    },
    onError: (error) => toast.error(t('documents:hooks.folderRenameError'), extractErrorMessage(error)),
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast.success(t('documents:hooks.folderDeleted'));
    },
    onError: (error) => toast.error(t('documents:hooks.folderDeleteError'), extractErrorMessage(error)),
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
      toast.success(t('documents:hooks.folderVisibilityUpdated'));
    },
    onError: (error) => toast.error(t('documents:hooks.folderVisibilityUpdateError'), extractErrorMessage(error)),
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
      toast.success(t('documents:hooks.folderShared'));
    },
    onError: (error) => toast.error(t('documents:hooks.folderShareError'), extractErrorMessage(error)),
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
      toast.success(t('documents:hooks.folderShareDeleted'));
    },
    onError: (error) => toast.error(t('documents:hooks.folderShareDeleteError'), extractErrorMessage(error)),
  });
}

export function useUploadFile(folderId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (pct: number) => void }) => uploadFile(folderId, file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', folderId] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'summary'] });
      toast.success(t('documents:hooks.uploadSuccess'));
    },
    onError: (error) => toast.error(t('documents:hooks.uploadError'), extractErrorMessage(error)),
  });
}

export function useUploadNewVersion(fileId: string, folderId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (pct: number) => void }) => uploadNewVersion(fileId, file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', folderId] });
      queryClient.invalidateQueries({ queryKey: ['file', fileId] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'summary'] });
      toast.success(t('documents:hooks.newVersionUploaded'));
    },
    onError: (error) => toast.error(t('documents:hooks.newVersionUploadError'), extractErrorMessage(error)),
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
    onSuccess: () => toast.success(t('documents:hooks.fileShared')),
    onError: (error) => toast.error(t('documents:hooks.fileShareError'), extractErrorMessage(error)),
  });
}

export function useDeleteFile(folderId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', folderId] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'summary'] });
      toast.success(t('documents:hooks.fileDeleted'));
    },
    onError: (error) => toast.error(t('documents:hooks.fileDeleteError'), extractErrorMessage(error)),
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
// 27/10/2026: moi loi "xem/mo tep" (bam ten tep, "Xem tệp", chip nguon Chat bot) da chuyen sang
// FilePreviewModal (useFilePreview ben duoi) - khong con mo tab moi nen khong con lo popup blocker.
// openFile() nay chi con phuc vu "Tải xuống" (attachment); ly do goi DONG BO trong onClick o tren
// van dung cho duong tai xuong.
// 28/10/2026: bo tham so disposition va nhanh 'inline' (khong con noi nao goi) - openFile(fileId) luon
// tai xuong attachment; xem truc tiep chi con di qua FilePreviewModal.
export function useDownloadFile() {
  const mutation = useMutation({
    mutationFn: (fileId: string) => getDownloadUrl(fileId, 'attachment'),
  });

  const openFile = (fileId: string) => {
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
      toast.info(t('documents:hooks.popupBlockedTitle'), t('documents:hooks.popupBlockedDescription'));
    }
    mutation.mutate(
      fileId,
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
          toast.error(t('documents:hooks.downloadFileError'), extractErrorMessage(error));
        },
      },
    );
  };

  return { ...mutation, openFile };
}

// 27/10/2026: xem tep NGAY TRONG app (FilePreviewModal) cho moi loi "bam ten tep/mo tep": danh sach
// (luoi + bang) o trang Tai lieu, muc "Tai lieu" cua trang chi tiet du an va chip nguon cua Chat bot.
// Truoc day bam ten tep mo tab moi voi disposition=inline: .txt/.csv bi server ep attachment (chong
// stored-XSS), Word/Excel/PowerPoint trinh duyet khong hien duoc => nguoi dung chi thay tep bi tai ve.
// Hook gom state cua modal + nut "Tải xuống" trong modal (attachment nhu cu); noi goi chi can
// `<FilePreviewModal {...preview.modalProps} />`. Noi chi co fileId (chip nguon Chat bot) dung
// openPreviewById: lay metadata GET /files/:id (chung cache ['file', id] voi useFileQuery, khong retry
// vi 404/403 khong tu het), loi thi toast; bam lien nhieu chip chi lay ket qua cua lan bam CUOI.
export function useFilePreview() {
  const queryClient = useQueryClient();
  const { openFile } = useDownloadFile();
  const [file, setFile] = useState<FileItem | null>(null);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const latestRequestRef = useRef(0);

  const openPreviewById = useCallback(
    async (fileId: string) => {
      const requestId = ++latestRequestRef.current;
      setLoadingFileId(fileId);
      try {
        const meta = await queryClient.fetchQuery({ queryKey: ['file', fileId], queryFn: () => fetchFile(fileId), retry: false });
        if (latestRequestRef.current === requestId) setFile(meta);
      } catch (error) {
        if (latestRequestRef.current === requestId) toast.error(t('documents:hooks.openFileError'), extractErrorMessage(error));
      } finally {
        if (latestRequestRef.current === requestId) setLoadingFileId(null);
      }
    },
    [queryClient],
  );
  const openPreview = useCallback((target: FileItem) => setFile(target), []);
  const closePreview = useCallback(() => setFile(null), []);
  // 28/10/2026: bo lan mo dang cho metadata (vd Esc dong panel Chat bot khi chip nguon con dang tai) -
  // truoc day request van chay tiep va modal tu mo len SAU khi panel da dong.
  const cancelPending = useCallback(() => {
    latestRequestRef.current += 1;
    setLoadingFileId(null);
  }, []);

  return {
    openPreview,
    openPreviewById,
    cancelPending,
    loadingFileId,
    modalProps: {
      file,
      open: file !== null,
      onClose: closePreview,
      onDownload: openFile,
    },
  };
}
