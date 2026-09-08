import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ChevronRightIcon, FileTextIcon, PlusIcon, UploadIcon, SearchIcon, GridIcon, ListIcon } from '@/components/ui/Icons';
import { useFilesQuery, useFoldersQuery } from './hooks';
import { FolderGrid } from './components/FolderGrid';
import { FileTable } from './components/FileTable';
import { NewFolderModal } from './components/NewFolderModal';
import { UploadModal } from './components/UploadModal';
import { ShareModal } from './components/ShareModal';
// 28/07/2026: modal quan ly chia se thu muc (tinh nang kiem soat truy cap thu muc theo cap do) -
// wire vao trang nay theo dung pattern sharingFile/ShareModal ngay ben duoi.
import { FolderShareModal } from './components/FolderShareModal';
import { VersionHistoryModal } from './components/VersionHistoryModal';
import { matchesVietnameseSearch } from '@/lib/utils';
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
  // 28/07/2026: sharingFolder - dieu khien FolderShareModal, mirror y het sharingFile/ShareModal o
  // tren (tinh nang kiem soat truy cap thu muc theo cap do).
  const [sharingFolder, setSharingFolder] = useState<Folder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const dragCounterRef = useRef(0);

  const foldersQuery = useFoldersQuery();
  const filesQuery = useFilesQuery(currentFolderId);
  const allFolders = foldersQuery.data ?? [];

  const subFolders = useMemo(() => allFolders.filter((f) => (f.parentId ?? null) === currentFolderId), [allFolders, currentFolderId]);

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
    if (!searchTerm.trim()) return subFolders;
    return subFolders.filter((f) => matchesVietnameseSearch(f.name, searchTerm));
  }, [subFolders, searchTerm]);

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
      if (droppedFiles && droppedFiles.length > 0) {
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
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-140px)] space-y-5">
      {/* Lớp phủ Dropzone Overlay mờ ảo toàn màn hình kèm viền đứt nét nổi bật khi kéo tệp vào */}
      {isWindowDragging && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center border-4 border-dashed border-primary-500 bg-slate-900/60 backdrop-blur-md text-center text-white transition-all animate-fade-in pointer-events-none p-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-2xl text-primary-600 mb-4 animate-bounce">
            <UploadIcon className="h-10 w-10" />
          </div>
          <h3 className="font-display text-2xl font-bold text-white tracking-tight">Thả tệp vào đây để tải lên</h3>
          <p className="mt-2 text-sm text-slate-200 max-w-md">
            Tệp sẽ được tự động tải trực tiếp vào thư mục{' '}
            <span className="font-bold text-primary-300">
              {breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].name : 'Tất cả tài liệu'}
            </span>
          </p>
        </div>
      )}
      {/* Hàng 1: Tiêu đề phân cấp Click-to-navigate + Nút hành động */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {/* Breadcrumb phân cấp dạng Tiêu đề chính có thể click */}
          <nav className="flex flex-wrap items-center gap-1.5 font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            <button
              onClick={() => setCurrentFolderId(null)}
              className={
                currentFolderId === null
                  ? 'text-slate-900 font-extrabold cursor-default'
                  : 'text-slate-500 hover:text-primary-600 transition-colors cursor-pointer'
              }
            >
              {t('documents:documentsPage.breadcrumbRoot')}
            </button>
            {breadcrumb.map((folder) => (
              <span key={folder.id} className="inline-flex items-center gap-1.5">
                <ChevronRightIcon className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                <button
                  onClick={() => setCurrentFolderId(folder.id)}
                  className={
                    folder.id === currentFolderId
                      ? 'text-lg sm:text-xl font-bold text-slate-900 cursor-default truncate max-w-[280px]'
                      : 'text-lg sm:text-xl font-medium text-slate-500 hover:text-primary-600 transition-colors cursor-pointer truncate max-w-[200px]'
                  }
                  title={folder.name}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </nav>
          {currentFolderId === null && (
            <p className="mt-1 text-xs sm:text-sm text-slate-500">{t('documents:documentsPage.subtitle')}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <Button variant="outline" onClick={() => setIsNewFolderOpen(true)}>
            <PlusIcon className="h-4 w-4" /> {t('documents:documentsPage.newFolder')}
          </Button>
          <Button onClick={() => setIsUploadOpen(true)}>
            <UploadIcon className="h-4 w-4" /> {t('documents:documentsPage.upload')}
          </Button>
        </div>
      </div>

      {/* Hàng 2: Dải Control Bar (Thanh tìm kiếm bên trái + Nút chuyển chế độ xem Lưới/Danh sách bên phải) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-xs">
        {/* Ô tìm kiếm tài liệu & thư mục */}
        <div className="relative flex-1 min-w-[240px] sm:max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('documents:documentsPage.searchPlaceholder')}
            className="h-9 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 pl-9 pr-3.5 text-xs text-slate-700 placeholder:text-slate-400 transition-all focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Cụm nút chuyển chế độ xem (Lưới / Danh sách) */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100/90 p-1 border border-slate-200/60">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title={t('documents:documentsPage.viewGridTitle')}
          >
            <GridIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t('documents:documentsPage.viewGrid')}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title={t('documents:documentsPage.viewListTitle')}
          >
            <ListIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t('documents:documentsPage.viewList')}</span>
          </button>
        </div>
      </div>

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
                <Button variant="outline" onClick={() => setIsNewFolderOpen(true)}>
                  {t('documents:documentsPage.emptyState.newFolder')}
                </Button>
                <Button onClick={() => setIsUploadOpen(true)}>{t('documents:documentsPage.emptyState.uploadFile')}</Button>
              </div>
            }
          />
        ) : isFilteredEmpty ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">Không tìm thấy tài liệu hoặc thư mục phù hợp</p>
            <p className="mt-1 text-xs text-slate-400">Hãy thử tìm kiếm với từ khóa khác</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 28/07/2026: them onShare={setSharingFolder} - mo FolderShareModal tu dropdown cua
                tung thu muc restricted (tinh nang kiem soat truy cap thu muc theo cap do). */}
            <FolderGrid
              folders={filteredFolders}
              onOpen={(folder) => setCurrentFolderId(folder.id)}
              onShare={setSharingFolder}
              viewMode={viewMode}
            />
            {filteredFiles.length > 0 && (
              <FileTable
                files={filteredFiles}
                folderId={currentFolderId}
                onShare={setSharingFile}
                onVersionHistory={setHistoryFile}
                viewMode={viewMode}
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
      <VersionHistoryModal file={historyFile} folderId={currentFolderId} onClose={() => setHistoryFile(null)} />
    </div>
  );
}
