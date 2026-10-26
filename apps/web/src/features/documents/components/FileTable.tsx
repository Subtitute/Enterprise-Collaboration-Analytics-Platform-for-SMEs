import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableHead, TableHeadCell } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Modal';
import { DownloadIcon, TrashIcon } from '@/components/ui/Icons';
import type { FileItem } from '@/types';
import { useDeleteFile, useDownloadFile } from '../hooks';
import { DocumentCard } from './DocumentCard';
import { DocumentTableRow } from './DocumentTableRow';
// 26/10/2026: nut ghi theo quyen cua CHINH tep (FileShare EDIT trong cay toan cong ty van hien).
import { canWriteFile } from '../writeAccess';

interface FileTableProps {
  files: FileItem[];
  folderId: string | null;
  onShare: (file: FileItem) => void;
  onVersionHistory: (file: FileItem) => void;
  onPreview?: (file: FileItem) => void;
  viewMode?: 'grid' | 'list';
  // 26/10/2026: false = nguoi goi chi xem thu muc nay (cay toan cong ty) - an chia se/xoa (writeAccess.ts).
  canWrite?: boolean;
}

export const FileTable = React.memo(function FileTable({
  files,
  folderId,
  onShare,
  onVersionHistory,
  onPreview,
  viewMode = 'list',
  canWrite = true,
}: FileTableProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState<FileItem | null>(null);
  const [batchDeleting, setBatchDeleting] = useState<string[] | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const download = useDownloadFile();
  const deleteFile = useDeleteFile(folderId);

  useEffect(() => {
    setSelectedFileIds([]);
  }, [folderId]);

  const isAllSelected = files.length > 0 && selectedFileIds.length === files.length;
  // 26/10/2026: xoa hang loat chi hien khi MOI tep dang chon deu ghi duoc.
  const canBatchDelete = selectedFileIds.every((id) => canWriteFile(files.find((f) => f.id === id), canWrite));
  const isSomeSelected = selectedFileIds.length > 0 && selectedFileIds.length < files.length;

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(files.map((f) => f.id));
    }
  }, [isAllSelected, files]);

  const toggleSelectFile = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const handleDownloadFile = useCallback(
    (id: string, disposition: 'inline' | 'attachment') => {
      download.openFile(id, disposition);
    },
    [download],
  );

  const handleBatchDownload = useCallback(() => {
    selectedFileIds.forEach((id, index) => {
      setTimeout(() => {
        download.openFile(id, 'attachment');
      }, index * 300);
    });
  }, [selectedFileIds, download]);

  const handleBatchDeleteConfirm = useCallback(() => {
    if (batchDeleting && batchDeleting.length > 0) {
      batchDeleting.forEach((id) => deleteFile.mutate(id));
      setSelectedFileIds((prev) => prev.filter((id) => !batchDeleting.includes(id)));
      setBatchDeleting(null);
    }
  }, [batchDeleting, deleteFile]);

  return (
    <>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {files.map((file) => (
            <DocumentCard
              key={file.id}
              file={file}
              isSelected={selectedFileIds.includes(file.id)}
              onToggleSelect={toggleSelectFile}
              onPreview={onPreview}
              onDownload={handleDownloadFile}
              onShare={onShare}
              onVersionHistory={onVersionHistory}
              onDelete={setDeleting}
              canWrite={canWriteFile(file, canWrite)}
            />
          ))}
        </div>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeadCell className="w-10">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isSomeSelected;
                  }}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded-radius-sm border-border-strong text-accent focus:ring-accent-soft cursor-pointer"
                  aria-label={t('documents:fileTable.selectAllAria')}
                />
              </TableHeadCell>
              <TableHeadCell>{t('documents:fileTable.columns.name')}</TableHeadCell>
              <TableHeadCell>{t('documents:fileTable.columns.size')}</TableHeadCell>
              <TableHeadCell>{t('documents:fileTable.columns.version')}</TableHeadCell>
              <TableHeadCell>{t('documents:fileTable.columns.updated')}</TableHeadCell>
              <TableHeadCell className="text-right">{t('documents:fileTable.columns.actions')}</TableHeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {files.map((file) => (
              <DocumentTableRow
                key={file.id}
                file={file}
                isSelected={selectedFileIds.includes(file.id)}
                onToggleSelect={toggleSelectFile}
                onPreview={onPreview}
                onDownload={handleDownloadFile}
                onShare={onShare}
                onVersionHistory={onVersionHistory}
                onDelete={setDeleting}
                canWrite={canWriteFile(file, canWrite)}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {/* Floating Action Bar */}
      {selectedFileIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-radius-lg border border-border-strong bg-white px-4 py-2 text-text-primary shadow-lg transition-all animate-slide-up">
            <div className="flex items-center gap-2 pr-3 border-r border-border-subtle">
              <span className="flex min-w-[20px] h-5 px-1.5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-mono font-medium text-white leading-none">
                {selectedFileIds.length}
              </span>
              <span className="text-[12px] font-medium text-text-primary">{t('documents:fileTable.selectedLabel')}</span>
            </div>

            <button
              type="button"
              onClick={handleBatchDownload}
              className="flex items-center gap-1.5 h-8 px-3 rounded-radius-sm bg-bg-subtle border border-border-subtle text-[12px] font-medium text-text-primary hover:border-border-strong transition-colors cursor-pointer"
            >
              <DownloadIcon className="h-3.5 w-3.5 text-text-secondary" />
              <span>{t('documents:fileTable.batchDownload')}</span>
            </button>

            {canBatchDelete && (
              <button
                type="button"
                onClick={() => setBatchDeleting(selectedFileIds)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-radius-sm bg-[#F8E5E3] border border-[#B3261E]/20 text-[12px] font-medium text-[#B3261E] hover:bg-[#F8E5E3]/80 transition-colors cursor-pointer"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                <span>{t('documents:fileTable.batchDelete')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedFileIds([])}
              className="ml-1 text-[12px] text-text-tertiary hover:text-text-primary hover:underline transition-colors cursor-pointer"
            >
              {t('documents:fileTable.deselectAll')}
            </button>
          </div>
        </div>
      )}

      {/* Dialog xác nhận xóa 1 tệp */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteFile.mutate(deleting.id);
          setDeleting(null);
        }}
        title={t('documents:fileTable.deleteConfirm.title')}
        description={deleting ? t('documents:fileTable.deleteConfirm.description', { name: deleting.name }) : undefined}
        confirmLabel={t('documents:fileTable.deleteConfirm.confirmLabel')}
        danger
      />

      {/* Dialog xác nhận xóa hàng loạt tệp */}
      <ConfirmDialog
        open={Boolean(batchDeleting && batchDeleting.length > 0)}
        onClose={() => setBatchDeleting(null)}
        onConfirm={handleBatchDeleteConfirm}
        title={t('documents:fileTable.batchDeleteConfirm.title')}
        description={t('documents:fileTable.batchDeleteConfirm.description', { count: batchDeleting?.length ?? 0 })}
        confirmLabel={t('documents:fileTable.batchDeleteConfirm.confirmLabel')}
        danger
      />
    </>
  );
});
