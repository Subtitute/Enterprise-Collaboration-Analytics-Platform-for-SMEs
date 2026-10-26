import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ChevronRightIcon, FileTextIcon, PlusIcon, UploadIcon } from '@/components/ui/Icons';
import { useFilesQuery, useFoldersQuery, useDownloadFile, useDocumentProjects } from './hooks';
import { FolderGrid } from './components/FolderGrid';
import { FileTable } from './components/FileTable';
import { COMPANY_WIDE_FILTER, DocumentFilterToolbar } from './components/DocumentFilterToolbar';
// 26/10/2026: tai lieu theo pham vi du an - bo loc du an o thu muc goc + chi Org Admin tai tep len goc.
import { useIsOrgAdmin } from './components/FolderProjectSelect';
import { NewFolderModal } from './components/NewFolderModal';
import { UploadModal } from './components/UploadModal';
import { ShareModal } from './components/ShareModal';
import { FolderShareModal } from './components/FolderShareModal';
import { VersionHistoryModal } from './components/VersionHistoryModal';
import { FilePreviewModal } from './components/FilePreviewModal';
import { matchesVietnameseSearch } from '@/lib/utils';
import { toast } from '@/stores/toast.store';
// 26/10/2026: quyen ghi tai lieu (cay toan cong ty chi Org Admin) - cung quy tac backend.
import { canWriteFile, canWriteFolder } from './writeAccess';
import type { FileItem, Folder } from '@/types';

export function DocumentsPage() {
  const { t } = useTranslation();
  // 22/07/2026: chuyen currentFolderId tu useState noi bo sang query param ?folderId= tren URL
  // (setSearchParams mac dinh PUSH 1 history entry moi, giong navigate thong thuong) - truoc do
  // moi lan bam vao 1 thu muc chi doi state React, KHONG tao history entry nao, nen nut Back
  // cua trinh duyet bo qua toan bo qua trinh "di sau vao thu muc" va thoat thang ra trang truoc
  // do nguoi dung da vao Documents, dung nhu bao cao cua nguoi dung. Dua vao URL giup Back/Forward
  // lui/toi dung tung cap thu muc, dong thoi cho phep chia se link truc tiep toi 1 thu muc.
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get('folderId');
  const setCurrentFolderId = useCallback(
    (folderId: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (folderId) next.set('folderId', folderId);
        else next.delete('folderId');
        return next;
      });
    },
    [setSearchParams],
  );
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [sharingFile, setSharingFile] = useState<FileItem | null>(null);
  const [historyFile, setHistoryFile] = useState<FileItem | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const download = useDownloadFile();
  // 28/07/2026: sharingFolder - dieu khien FolderShareModal, mirror y het sharingFile/ShareModal o
  // tren (tinh nang kiem soat truy cap thu muc theo cap do).
  const [sharingFolder, setSharingFolder] = useState<Folder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const dragCounterRef = useRef(0);

  const foldersQuery = useFoldersQuery();
  const filesQuery = useFilesQuery(currentFolderId);
  const allFolders = foldersQuery.data ?? [];

  const subFolders = useMemo(() => allFolders.filter((f) => (f.parentId ?? null) === currentFolderId), [allFolders, currentFolderId]);
  // 26/10/2026: o thu muc goc, loc thu muc theo du an ('' = tat ca, COMPANY_WIDE_FILTER = toan cong
  // ty); lua chon chi gom cac du an dang co thu muc. Tep o goc la tai lieu toan cong ty - chi Org
  // Admin tai len duoc (backend tra 403 COMPANY_WIDE_ADMIN_ONLY), nen an nut/keo-tha o goc voi nguoi khac.
  const [projectFilter, setProjectFilter] = useState('');
  const { projectNames } = useDocumentProjects();
  const isOrgAdmin = useIsOrgAdmin();
  const isRoot = currentFolderId === null;
  // 26/10/2026: cay toan cong ty (thu muc khong du an) chi Org Admin ghi - cung quy tac backend (writeAccess.ts).
  const canUploadHere = canWriteFolder(isRoot ? null : allFolders.find((f) => f.id === currentFolderId), isOrgAdmin);
  const folderProjectOptions = useMemo(() => {
    const ids = [...new Set(subFolders.map((f) => f.projectId).filter((id): id is string => Boolean(id)))];
    return ids
      .map((id) => ({ id, name: projectNames.get(id) ?? t('documents:projectScope.unknownProject') }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [subFolders, projectNames, t]);

  const breadcrumb = useMemo(() => {
    const trail: Folder[] = [];
    let cursor = allFolders.find((f) => f.id === currentFolderId);
    while (cursor) {
      trail.unshift(cursor);
      cursor = allFolders.find((f) => f.id === cursor!.parentId);
    }
    return trail;
  }, [allFolders, currentFolderId]);

  const isLoading = foldersQuery.isLoading || filesQuery.isLoading;
  const isError = foldersQuery.isError || filesQuery.isError;
  const files = filesQuery.data ?? [];

  const filteredFolders = useMemo(() => {
    const byProject =
      !isRoot || !projectFilter
        ? subFolders
        : subFolders.filter((f) => (projectFilter === COMPANY_WIDE_FILTER ? !f.projectId : f.projectId === projectFilter));
    if (!searchTerm.trim()) return byProject;
    return byProject.filter((f) => matchesVietnameseSearch(f.name, searchTerm));
  }, [subFolders, searchTerm, isRoot, projectFilter]);

  const filteredFiles = useMemo(() => {
    if (!searchTerm.trim()) return files;
    return files.filter((f) => matchesVietnameseSearch(f.name, searchTerm));
  }, [files, searchTerm]);

  const isEmpty = !isLoading && !isError && subFolders.length === 0 && files.length === 0;
  const isFilteredEmpty = !isLoading && !isError && !isEmpty && filteredFolders.length === 0 && filteredFiles.length === 0;

  // Lắng nghe sự kiện kéo tệp từ máy tính trên toàn bộ Window
  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      // Chỉ kích hoạt khi kéo file (chứa types 'Files')
      if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files')) {
        dragCounterRef.current += 1;
        setIsWindowDragging(true);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsWindowDragging(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsWindowDragging(false);
      const droppedFiles = e.dataTransfer?.files;
      // 26/10/2026: thu muc goc chi Org Admin tai len duoc - bao ro thay vi mo modal roi nhan 403.
      if (droppedFiles && droppedFiles.length > 0 && !canUploadHere) {
        toast.info(t(isRoot ? 'documents:projectScope.rootUploadAdminOnly' : 'documents:projectScope.companyWideReadOnly'));
        return;
      }
      if (droppedFiles && droppedFiles.length > 0) {
        // 15/09/2026: UploadModal chi nhan 1 file/lan (thiet ke co chu dich) - truoc ban sua nay,
        // keo nhieu file cung luc vao day se AM THAM chi lay file dau tien, cac file con lai mat
        // khong dau vet, khong bao gi cho nguoi dung biet. Bao mot toast thong bao khi bi cat bot.
        if (droppedFiles.length > 1) {
          toast.info(t('documents:documentsPage.dropzone.multipleFilesTitle'), t('documents:documentsPage.dropzone.multipleFilesDescription'));
        }
        setDroppedFile(droppedFiles[0]);
        setIsUploadOpen(true);
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
    };
    // 26/10/2026: gan lai khi doi thu muc - handleWindowDrop doc canUploadHere moi nhat.
  }, [canUploadHere, isRoot, t]);

  const handleClearSearch = useCallback(() => setSearchTerm(''), []);
  const handleOpenFolder = useCallback((folder: Folder) => setCurrentFolderId(folder.id), [setCurrentFolderId]);
  const handleDownloadFile = useCallback((fileId: string) => download.openFile(fileId, 'attachment'), [download]);

  return (
    <div className="relative min-h-[calc(100vh-140px)] space-y-5">
      {/* Lớp phủ Dropzone Overlay mờ ảo toàn màn hình kèm viền đứt nét nổi bật khi kéo tệp vào */}
      {isWindowDragging && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center border-4 border-dashed border-accent bg-[#1C1B1A]/60 text-center text-white transition-all animate-fade-in pointer-events-none p-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-radius-lg bg-accent-soft text-accent mb-4 animate-bounce">
            <UploadIcon className="h-10 w-10" />
          </div>
          <h3 className="font-sans text-2xl font-bold text-white tracking-tight">{t('documents:documentsPage.dropzone.title')}</h3>
          <p className="mt-2 text-[14px] text-white/80 max-w-md">
            {t('documents:documentsPage.dropzone.description')}{' '}
            <span className="font-semibold text-accent-soft">
              {breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].name : t('documents:documentsPage.breadcrumbRoot')}
            </span>
          </p>
        </div>
      )}
      {/* Hàng 1: Tiêu đề phân cấp Click-to-navigate + Nút hành động (§2.1) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {/* Breadcrumb phân cấp */}
          <nav className="flex flex-wrap items-center gap-1.5 font-sans text-[24px] sm:text-[28px] leading-[36px] font-semibold tracking-tight text-text-primary">
            <button
              type="button"
              onClick={() => setCurrentFolderId(null)}
              className={
                currentFolderId === null
                  ? 'text-text-primary font-semibold cursor-default'
                  : 'text-text-secondary hover:text-accent transition-colors cursor-pointer'
              }
            >
              {t('documents:documentsPage.breadcrumbRoot')}
            </button>
            {breadcrumb.map((folder, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <span key={folder.id} className="inline-flex items-center gap-1.5">
                  <ChevronRightIcon className="h-4 w-4 text-text-tertiary shrink-0" />
                  {isLast ? (
                    <span className="text-[20px] sm:text-[24px] font-medium text-text-primary truncate max-w-[280px]" title={folder.name}>
                      {folder.name}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCurrentFolderId(folder.id)}
                      className="text-[20px] sm:text-[24px] font-medium text-text-secondary hover:text-accent transition-colors cursor-pointer truncate max-w-[200px]"
                      title={folder.name}
                    >
                      {folder.name}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
          {currentFolderId === null && (
            <p className="mt-1 text-[13px] sm:text-[14px] leading-[22px] text-text-secondary">{t('documents:documentsPage.subtitle')}</p>
          )}
        </div>

        {/* Nút phải: + Thư mục mới = Secondary; + Tải lên = Primary ink */}
        <div className="flex shrink-0 items-center gap-2">
          {/* 26/10/2026: o goc ai cung tao duoc thu muc du an; trong cay toan cong ty chi khi ghi duoc. */}
          {(isRoot || canUploadHere) && (
            <button
              type="button"
              onClick={() => setIsNewFolderOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-radius-md border border-border-strong bg-white text-[13px] font-medium text-text-primary hover:bg-bg-subtle transition-colors cursor-pointer"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>{t('documents:documentsPage.newFolder')}</span>
            </button>
          )}
          {canUploadHere && (
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-radius-md bg-[#1C1B1A] hover:bg-[#2E2C29] text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              <UploadIcon className="h-3.5 w-3.5" />
              <span>{t('documents:documentsPage.upload')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Hàng 2: Toolbar 1 hàng ngang (§2.2: [Search flex-1] [Grid/List Segmented Control]) */}
      <DocumentFilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClearSearch={handleClearSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        // 26/10/2026: bo loc du an chi o thu muc goc (noi thu muc gan du an).
        projectFilter={projectFilter}
        onProjectFilterChange={isRoot ? setProjectFilter : undefined}
        projectOptions={folderProjectOptions}
      />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        onRetry={() => {
          foldersQuery.refetch();
          filesQuery.refetch();
        }}
        loadingFallback={<FullPageSpinner label={t('documents:documentsPage.loading')} />}
        errorTitle={t('documents:documentsPage.errorTitle')}
        errorDescription={t('documents:documentsPage.errorDescription')}
      >
        {isEmpty ? (
          <EmptyState
            icon={<FileTextIcon className="h-10 w-10" />}
            title={t('documents:documentsPage.emptyState.title')}
            description={t('documents:documentsPage.emptyState.description')}
            action={
              <div className="flex gap-2">
                {(isRoot || canUploadHere) && (
                  <Button variant="outline" onClick={() => setIsNewFolderOpen(true)}>
                    {t('documents:documentsPage.emptyState.newFolder')}
                  </Button>
                )}
                {canUploadHere && <Button onClick={() => setIsUploadOpen(true)}>{t('documents:documentsPage.emptyState.uploadFile')}</Button>}
              </div>
            }
          />
        ) : isFilteredEmpty ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">{t('documents:documentsPage.filteredEmpty.title')}</p>
            <p className="mt-1 text-xs text-slate-400">{t('documents:documentsPage.filteredEmpty.description')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 28/07/2026: them onShare={setSharingFolder} - mo FolderShareModal tu dropdown cua
                tung thu muc restricted (tinh nang kiem soat truy cap thu muc theo cap do). */}
            <FolderGrid
              folders={filteredFolders}
              onOpen={handleOpenFolder}
              onShare={setSharingFolder}
              viewMode={viewMode}
            />
            {filteredFiles.length > 0 && (
              <FileTable
                files={filteredFiles}
                folderId={currentFolderId}
                onShare={setSharingFile}
                onVersionHistory={setHistoryFile}
                onPreview={setPreviewFile}
                viewMode={viewMode}
                canWrite={canUploadHere}
              />
            )}
          </div>
        )}
      </QueryState>

      <NewFolderModal parentId={currentFolderId} open={isNewFolderOpen} onClose={() => setIsNewFolderOpen(false)} />
      <UploadModal
        folderId={currentFolderId}
        open={isUploadOpen}
        initialFile={droppedFile}
        onClose={() => {
          setIsUploadOpen(false);
          setDroppedFile(null);
        }}
      />
      <ShareModal file={sharingFile} onClose={() => setSharingFile(null)} />
      {/* 28/07/2026: render FolderShareModal, mirror vi tri/pattern cua ShareModal (tep) ngay tren. */}
      <FolderShareModal folder={sharingFolder} onClose={() => setSharingFolder(null)} />
      <VersionHistoryModal file={historyFile} folderId={currentFolderId} onClose={() => setHistoryFile(null)} canWrite={canWriteFile(historyFile, canUploadHere)} />
      <FilePreviewModal
        file={previewFile}
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownloadFile}
      />
    </div>
  );
}
