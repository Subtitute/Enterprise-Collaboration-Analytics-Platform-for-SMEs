import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { DownloadIcon, EyeIcon, FileIcon, MoreVerticalIcon, ShareIcon, ClockIcon, TrashIcon } from '@/components/ui/Icons';
import { formatBytes, formatDateTime } from '@/lib/utils';
import type { FileItem } from '@/types';
import { useDeleteFile, useDownloadFile } from '../hooks';

// Phân loại màu sắc icon theo spec:
// PDF: file-text — error #B3261E
// Word/Doc: file-text — info #1E5A8A
// Excel/CSV: file-spreadsheet — success #2F6F44
// Image: image — accent #0E5E5E
// Khác: file — text-secondary
function getFileTypeTheme(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      bg: 'bg-[#E6F1E9] text-[#2F6F44]',
      badge: 'border-[#2F6F44]/30 bg-[#E6F1E9] text-[#2F6F44]',
      iconText: 'text-[#2F6F44]',
      label: ext.toUpperCase(),
    };
  }
  if (['pdf'].includes(ext)) {
    return {
      bg: 'bg-[#F8E5E3] text-[#B3261E]',
      badge: 'border-[#B3261E]/30 bg-[#F8E5E3] text-[#B3261E]',
      iconText: 'text-[#B3261E]',
      label: 'PDF',
    };
  }
  if (['doc', 'docx'].includes(ext)) {
    return {
      bg: 'bg-[#EBF3F8] text-[#1E5A8A]',
      badge: 'border-[#1E5A8A]/30 bg-[#EBF3F8] text-[#1E5A8A]',
      iconText: 'text-[#1E5A8A]',
      label: 'DOC',
    };
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return {
      bg: 'bg-[#FBEEE0] text-[#B45309]',
      badge: 'border-[#B45309]/30 bg-[#FBEEE0] text-[#B45309]',
      iconText: 'text-[#B45309]',
      label: 'PPT',
    };
  }
  if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext)) {
    return {
      bg: 'bg-accent-soft text-accent',
      badge: 'border-accent/30 bg-accent-soft text-accent',
      iconText: 'text-accent',
      label: 'IMG',
    };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      bg: 'bg-bg-subtle text-text-secondary',
      badge: 'border-border-subtle bg-bg-subtle text-text-secondary',
      iconText: 'text-text-secondary',
      label: 'ZIP',
    };
  }
  return {
    bg: 'bg-bg-subtle text-text-secondary',
    badge: 'border-border-subtle bg-bg-subtle text-text-secondary',
    iconText: 'text-text-secondary',
    label: ext ? ext.toUpperCase() : 'FILE',
  };
}

interface FileTableProps {
  files: FileItem[];
  folderId: string | null;
  onShare: (file: FileItem) => void;
  onVersionHistory: (file: FileItem) => void;
  onPreview?: (file: FileItem) => void;
  viewMode?: 'grid' | 'list';
}

export function FileTable({ files, folderId, onShare, onVersionHistory, onPreview, viewMode = 'list' }: FileTableProps) {
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
  const isSomeSelected = selectedFileIds.length > 0 && selectedFileIds.length < files.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(files.map((f) => f.id));
    }
  };

  const toggleSelectFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleBatchDownload = () => {
    selectedFileIds.forEach((id, index) => {
      setTimeout(() => {
        download.openFile(id, 'attachment');
      }, index * 300);
    });
  };

  const handleBatchDeleteConfirm = () => {
    if (batchDeleting && batchDeleting.length > 0) {
      batchDeleting.forEach((id) => deleteFile.mutate(id));
      setSelectedFileIds((prev) => prev.filter((id) => !batchDeleting.includes(id)));
      setBatchDeleting(null);
    }
  };

  return (
    <>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {files.map((file) => {
            const theme = getFileTypeTheme(file.name);
            const isSelected = selectedFileIds.includes(file.id);
            return (
              <div
                key={file.id}
                className={`group relative flex flex-col justify-between p-5 rounded-radius-lg border bg-white transition-colors cursor-pointer select-none ${
                  isSelected
                    ? 'border-accent bg-accent-soft/30 ring-1 ring-accent'
                    : 'border-border-subtle hover:border-border-strong'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => toggleSelectFile(file.id, e)}
                      onChange={() => {}}
                      className="h-4 w-4 rounded-radius-sm border-border-strong text-accent focus:ring-accent-soft cursor-pointer"
                      aria-label={t('documents:fileTable.selectFileAria', { name: file.name })}
                    />
                    <button
                      type="button"
                      onClick={() => (onPreview ? onPreview(file) : download.openFile(file.id, 'inline'))}
                      title={t('documents:fileTable.openFileTitle')}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-radius-md font-bold transition-colors ${theme.bg}`}>
                        <FileIcon className="h-5 w-5 stroke-1.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] leading-5 font-medium text-text-primary group-hover:text-accent transition-colors">
                          {file.name}
                        </span>
                        <span className="font-mono text-[12px] leading-4 text-text-tertiary tabular-nums">
                          {formatBytes(file.size)} • v{file.version ?? 1}
                        </span>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => download.openFile(file.id, 'attachment')}
                      title={t('documents:fileTable.download')}
                      className="flex h-6 w-6 items-center justify-center rounded-radius-sm text-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-bg-subtle hover:text-text-primary transition-all cursor-pointer"
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </button>

                    <Dropdown
                      align="right"
                      trigger={({ toggle }) => (
                        <button
                          onClick={toggle}
                          className="flex h-6 w-6 items-center justify-center rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary cursor-pointer transition-colors"
                          aria-label={t('documents:fileTable.optionsAria')}
                        >
                          <MoreVerticalIcon className="h-4 w-4" />
                        </button>
                      )}
                    >
                      {({ close }) => (
                        <div className="min-w-[200px] p-1 rounded-radius-md border border-border-subtle bg-white shadow-md">
                          <DropdownItem
                            className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                            onClick={() => {
                              download.openFile(file.id, 'attachment');
                              close();
                            }}
                          >
                            <DownloadIcon className="h-4 w-4 text-text-secondary" /> {t('documents:fileTable.download')}
                          </DropdownItem>
                          <DropdownItem
                            className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                            onClick={() => {
                              onShare(file);
                              close();
                            }}
                          >
                            <ShareIcon className="h-4 w-4 text-text-secondary" /> {t('documents:fileTable.share')}
                          </DropdownItem>
                          <DropdownItem
                            className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                            onClick={() => {
                              onVersionHistory(file);
                              close();
                            }}
                          >
                            <ClockIcon className="h-4 w-4 text-text-secondary" /> {t('documents:fileTable.versionHistory')}
                          </DropdownItem>
                          <DropdownItem
                            className="h-9 px-2.5 rounded-radius-sm text-[13px] text-[#B3261E] hover:bg-[#F8E5E3]"
                            onClick={() => {
                              setDeleting(file);
                              close();
                            }}
                          >
                            <TrashIcon className="h-4 w-4 text-[#B3261E]" /> {t('documents:fileTable.delete')}
                          </DropdownItem>
                        </div>
                      )}
                    </Dropdown>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2 text-[11px] font-mono text-text-tertiary tabular-nums">
                  <span>{t('documents:fileTable.updatedLabel', { date: formatDateTime(file.updatedAt) })}</span>
                </div>
              </div>
            );
          })}
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
            {files.map((file) => {
              const theme = getFileTypeTheme(file.name);
              const isSelected = selectedFileIds.includes(file.id);
              return (
                <TableRow key={file.id} className={`group ${isSelected ? 'bg-accent-soft/30' : ''}`}>
                  <TableCell className="w-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => toggleSelectFile(file.id, e)}
                      onChange={() => {}}
                      className="h-4 w-4 rounded-radius-sm border-border-strong text-accent focus:ring-accent-soft cursor-pointer"
                      aria-label={t('documents:fileTable.selectFileAria', { name: file.name })}
                    />
                  </TableCell>
                  <TableCell label={t('documents:fileTable.columns.name')}>
                    <button
                      type="button"
                      onClick={() => (onPreview ? onPreview(file) : download.openFile(file.id, 'inline'))}
                      title={t('documents:fileTable.openFileTitle')}
                      className="flex min-w-0 items-center gap-3 text-left transition-colors cursor-pointer"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-radius-md ${theme.bg}`}>
                        <FileIcon className="h-5 w-5 stroke-1.5" />
                      </span>
                      <span className="truncate text-[13px] font-medium text-text-primary hover:text-accent transition-colors">{file.name}</span>
                    </button>
                  </TableCell>
                  <TableCell label={t('documents:fileTable.columns.size')} className="whitespace-nowrap font-mono text-[12px] text-text-tertiary tabular-nums">
                    {formatBytes(file.size)}
                  </TableCell>
                  <TableCell label={t('documents:fileTable.columns.version')}>
                    <Badge variant="outline" className="font-mono text-[11px] tabular-nums">v{file.version ?? 1}</Badge>
                  </TableCell>
                  <TableCell label={t('documents:fileTable.columns.updated')} className="whitespace-nowrap font-mono text-[12px] text-text-tertiary tabular-nums">
                    {formatDateTime(file.updatedAt)}
                  </TableCell>
                  <TableCell label={t('documents:fileTable.columns.actions')} className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => download.openFile(file.id, 'attachment')}
                        title={t('documents:fileTable.download')}
                        className="flex h-6 w-6 items-center justify-center rounded-radius-sm text-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-bg-subtle hover:text-text-primary transition-all cursor-pointer"
                      >
                        <DownloadIcon className="h-4 w-4" />
                      </button>
                      <Dropdown
                        align="right"
                        trigger={({ toggle }) => (
                          <button
                            onClick={toggle}
                            className="flex h-6 w-6 items-center justify-center rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
                            aria-label={t('documents:fileTable.optionsAria')}
                          >
                            <MoreVerticalIcon className="h-4 w-4" />
                          </button>
                        )}
                      >
                        {({ close }) => (
                          <div className="min-w-[200px] p-1 rounded-radius-md border border-border-subtle bg-white shadow-md">
                            <DropdownItem
                              className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                              onClick={() => {
                                download.openFile(file.id, 'attachment');
                                close();
                              }}
                            >
                              <DownloadIcon className="h-4 w-4 text-text-secondary" /> {t('documents:fileTable.download')}
                            </DropdownItem>
                            <DropdownItem
                              className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                              onClick={() => {
                                onShare(file);
                                close();
                              }}
                            >
                              <ShareIcon className="h-4 w-4 text-text-secondary" /> {t('documents:fileTable.share')}
                            </DropdownItem>
                            <DropdownItem
                              className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                              onClick={() => {
                                onVersionHistory(file);
                                close();
                              }}
                            >
                              <ClockIcon className="h-4 w-4 text-text-secondary" /> {t('documents:fileTable.versionHistory')}
                            </DropdownItem>
                            <DropdownItem
                              className="h-9 px-2.5 rounded-radius-sm text-[13px] text-[#B3261E] hover:bg-[#F8E5E3]"
                              onClick={() => {
                                setDeleting(file);
                                close();
                              }}
                            >
                              <TrashIcon className="h-4 w-4 text-[#B3261E]" /> {t('documents:fileTable.delete')}
                            </DropdownItem>
                          </div>
                        )}
                      </Dropdown>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
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

            <button
              type="button"
              onClick={() => setBatchDeleting(selectedFileIds)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-radius-sm bg-[#F8E5E3] border border-[#B3261E]/20 text-[12px] font-medium text-[#B3261E] hover:bg-[#F8E5E3]/80 transition-colors cursor-pointer"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              <span>{t('documents:fileTable.batchDelete')}</span>
            </button>

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
}
