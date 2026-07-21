import { useMemo, useState } from 'react';
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
import { VersionHistoryModal } from './components/VersionHistoryModal';
import type { FileItem, Folder } from '@/types';

export function DocumentsPage() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [sharingFile, setSharingFile] = useState<FileItem | null>(null);
  const [historyFile, setHistoryFile] = useState<FileItem | null>(null);

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
          <h1 className="text-xl font-semibold text-slate-900">Tài liệu</h1>
          <p className="text-sm text-slate-500">Quản lý thư mục và tệp tài liệu dùng chung của tổ chức.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsNewFolderOpen(true)}>
            <PlusIcon className="h-4 w-4" /> Thư mục mới
          </Button>
          <Button onClick={() => setIsUploadOpen(true)}>
            <UploadIcon className="h-4 w-4" /> Tải lên
          </Button>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <button
          onClick={() => setCurrentFolderId(null)}
          className={currentFolderId === null ? 'font-medium text-slate-900' : 'hover:text-primary-600'}
        >
          Tất cả tài liệu
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
        loadingFallback={<FullPageSpinner label="Đang tải tài liệu…" />}
        errorTitle="Không thể tải tài liệu"
        errorDescription="Đã xảy ra lỗi khi tải thư mục/tệp. Vui lòng thử lại."
      >
        {isEmpty ? (
          <EmptyState
            icon={<FileTextIcon className="h-10 w-10" />}
            title="Thư mục trống"
            description="Tạo thư mục con hoặc tải lên tài liệu đầu tiên."
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsNewFolderOpen(true)}>
                  Thư mục mới
                </Button>
                <Button onClick={() => setIsUploadOpen(true)}>Tải lên tài liệu</Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-4">
            <FolderGrid folders={subFolders} onOpen={(folder) => setCurrentFolderId(folder.id)} />
            {files.length > 0 && (
              <FileTable files={files} folderId={currentFolderId} onShare={setSharingFile} onVersionHistory={setHistoryFile} />
            )}
          </div>
        )}
      </QueryState>

      <NewFolderModal parentId={currentFolderId} open={isNewFolderOpen} onClose={() => setIsNewFolderOpen(false)} />
      <UploadModal folderId={currentFolderId} open={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
      <ShareModal file={sharingFile} onClose={() => setSharingFile(null)} />
      <VersionHistoryModal file={historyFile} folderId={currentFolderId} onClose={() => setHistoryFile(null)} />
    </div>
  );
}
