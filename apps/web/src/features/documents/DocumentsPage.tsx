import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ChevronRightIcon, FileTextIcon, PlusIcon, UploadIcon } from '@/components/ui/Icons';
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
  const isEmpty = !isLoading && subFolders.length === 0 && files.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('documents:documentsPage.title')}</h1>
          <p className="text-sm text-slate-500">{t('documents:documentsPage.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsNewFolderOpen(true)}>
            <PlusIcon className="h-4 w-4" /> {t('documents:documentsPage.newFolder')}
          </Button>
          <Button onClick={() => setIsUploadOpen(true)}>
            <UploadIcon className="h-4 w-4" /> {t('documents:documentsPage.upload')}
          </Button>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <button
          onClick={() => setCurrentFolderId(null)}
          className={currentFolderId === null ? 'font-medium text-slate-900' : 'hover:text-primary-600'}
        >
          {t('documents:documentsPage.breadcrumbRoot')}
        </button>
        {breadcrumb.map((folder) => (
          <span key={folder.id} className="flex items-center gap-1">
            <ChevronRightIcon className="h-3.5 w-3.5 text-slate-300" />
            <button
              onClick={() => setCurrentFolderId(folder.id)}
              className={folder.id === currentFolderId ? 'font-medium text-slate-900' : 'hover:text-primary-600'}
            >
              {folder.name}
            </button>
          </span>
        ))}
      </nav>

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
        ) : (
          <div className="space-y-4">
            {/* 28/07/2026: them onShare={setSharingFolder} - mo FolderShareModal tu dropdown cua
                tung thu muc restricted (tinh nang kiem soat truy cap thu muc theo cap do). */}
            <FolderGrid folders={subFolders} onOpen={(folder) => setCurrentFolderId(folder.id)} onShare={setSharingFolder} />
            {files.length > 0 && (
              <FileTable files={files} folderId={currentFolderId} onShare={setSharingFile} onVersionHistory={setHistoryFile} />
            )}
          </div>
        )}
      </QueryState>

      <NewFolderModal parentId={currentFolderId} open={isNewFolderOpen} onClose={() => setIsNewFolderOpen(false)} />
      <UploadModal folderId={currentFolderId} open={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
      <ShareModal file={sharingFile} onClose={() => setSharingFile(null)} />
      {/* 28/07/2026: render FolderShareModal, mirror vi tri/pattern cua ShareModal (tep) ngay tren. */}
      <FolderShareModal folder={sharingFolder} onClose={() => setSharingFolder(null)} />
      <VersionHistoryModal file={historyFile} folderId={currentFolderId} onClose={() => setHistoryFile(null)} />
    </div>
  );
}
