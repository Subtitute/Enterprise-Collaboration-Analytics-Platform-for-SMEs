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

// Phân loại màu sắc icon độc lập cho từng định dạng file (.csv/Excel xanh lá, PDF đỏ, Word xanh dương)
function getFileTypeTheme(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      bg: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
      badge: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
      iconText: 'text-emerald-600',
      label: ext.toUpperCase(),
    };
  }
  if (['pdf'].includes(ext)) {
    return {
      bg: 'bg-rose-50 text-rose-600 group-hover:bg-rose-100',
      badge: 'border-rose-200 bg-rose-50/70 text-rose-700',
      iconText: 'text-rose-600',
      label: 'PDF',
    };
  }
  if (['doc', 'docx'].includes(ext)) {
    return {
      bg: 'bg-sky-50 text-sky-600 group-hover:bg-sky-100',
      badge: 'border-sky-200 bg-sky-50/70 text-sky-700',
      iconText: 'text-sky-600',
      label: 'DOC',
    };
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return {
      bg: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100',
      badge: 'border-amber-200 bg-amber-50/70 text-amber-700',
      iconText: 'text-amber-600',
      label: 'PPT',
    };
  }
  if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext)) {
    return {
      bg: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100',
      badge: 'border-purple-200 bg-purple-50/70 text-purple-700',
      iconText: 'text-purple-600',
      label: 'IMG',
    };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      bg: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100',
      badge: 'border-orange-200 bg-orange-50/70 text-orange-700',
      iconText: 'text-orange-600',
      label: 'ZIP',
    };
  }
  return {
    bg: 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/80',
    badge: 'border-slate-200 bg-slate-50 text-slate-700',
    iconText: 'text-slate-600',
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

  // 15/09/2026: FileTable la cung 1 instance component khi dieu huong giua cac thu muc (chi doi
  // prop `folderId`/`files`, khong unmount) - truoc ban sua nay selectedFileIds khong bao gio duoc
  // xoa khi doi thu muc, nen chon file o thu muc A roi chuyen sang thu muc B van con giu "da chon"
  // nhung id khong con thuoc `files` hien tai - thanh hanh dong hang loat (tai ve/xoa) co the am
  // tham thao tac tren id file khong con hien tren man hinh. Reset ve rong moi khi doi thu muc.
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => {
            const theme = getFileTypeTheme(file.name);
            const isSelected = selectedFileIds.includes(file.id);
            return (
              <div
                key={file.id}
                className={`group relative flex flex-col justify-between rounded-xl border bg-white p-3.5 shadow-2xs transition-all duration-200 ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50/20 ring-2 ring-primary-100 shadow-xs'
                    : 'border-slate-200/80 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    {/* Checkbox chọn tệp tin */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => toggleSelectFile(file.id, e)}
                      onChange={() => {}}
                      className="h-4 w-4 rounded-md border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      aria-label={t('documents:fileTable.selectFileAria', { name: file.name })}
                    />
                    <button
                      type="button"
                      onClick={() => (onPreview ? onPreview(file) : download.openFile(file.id, 'inline'))}
                      title={t('documents:fileTable.openFileTitle')}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition-colors ${theme.bg}`}>
                        <FileIcon className="h-5.5 w-5.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-primary-600 transition-colors">
                          {file.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatBytes(file.size)} • v{file.version ?? 1}
                        </span>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Tối giản nút hành động: Icon tải xuống gọn gàng chỉ hiện khi hover thẻ */}
                    <button
                      type="button"
                      onClick={() => download.openFile(file.id, 'attachment')}
                      title={t('documents:fileTable.download')}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-primary-600 active:scale-95 transition-all cursor-pointer"
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </button>

                    <Dropdown
                      align="right"
                      trigger={({ toggle }) => (
                        <button
                          onClick={toggle}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                          aria-label={t('documents:fileTable.optionsAria')}
                        >
                          <MoreVerticalIcon className="h-4 w-4" />
                        </button>
                      )}
                    >
                      {({ close }) => (
                        <div className="w-48 py-1.5 shadow-md">
                          <DropdownItem
                            onClick={() => {
                              download.openFile(file.id, 'attachment');
                              close();
                            }}
                          >
                            <DownloadIcon className="h-4 w-4" /> {t('documents:fileTable.download')}
                          </DropdownItem>
                          <DropdownItem
                            onClick={() => {
                              onShare(file);
                              close();
                            }}
                          >
                            <ShareIcon className="h-4 w-4 text-primary-600" /> {t('documents:fileTable.share')}
                          </DropdownItem>
                          <DropdownItem
                            onClick={() => {
                              onVersionHistory(file);
                              close();
                            }}
                          >
                            <ClockIcon className="h-4 w-4" /> {t('documents:fileTable.versionHistory')}
                          </DropdownItem>
                          <DropdownItem
                            className="text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              setDeleting(file);
                              close();
                            }}
                          >
                            <TrashIcon className="h-4 w-4" /> {t('documents:fileTable.delete')}
                          </DropdownItem>
                        </div>
                      )}
                    </Dropdown>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100/90 pt-2.5 text-[11px] text-slate-400">
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
                  className="h-4 w-4 rounded-md border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
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
                <TableRow key={file.id} className={`group ${isSelected ? 'bg-primary-50/20' : ''}`}>
                  <TableCell className="w-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => toggleSelectFile(file.id, e)}
                      onChange={() => {}}
                      className="h-4 w-4 rounded-md border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      aria-label={t('documents:fileTable.selectFileAria', { name: file.name })}
                    />
                  </TableCell>
                  <TableCell label={t('documents:fileTable.columns.name')}>
                    <button
                      type="button"
                      onClick={() => (onPreview ? onPreview(file) : download.openFile(file.id, 'inline'))}
                      title={t('documents:fileTable.openFileTitle')}
                      className="flex min-w-0 items-center gap-2.5 text-left group-hover:text-primary-600 transition-colors cursor-pointer"
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${theme.bg}`}>
                        <FileIcon className="h-4 w-4" />
                      </span>
                      <span className="truncate font-medium text-slate-800 group-hover:text-primary-600">{file.name}</span>
                    </button>
                  </TableCell>
                  <TableCell label={t('documents:fileTable.columns.size')} className="whitespace-nowrap text-xs text-slate-500">
                    {formatBytes(file.size)}
                  </TableCell>
                  <TableCell label={t('documents:fileTable.columns.version')}>
                    <Badge variant="outline">v{file.version ?? 1}</Badge>
                  </TableCell>
                  <TableCell label={t('documents:fileTable.columns.updated')} className="whitespace-nowrap text-xs text-slate-500">
                    {formatDateTime(file.updatedAt)}
                  </TableCell>
                  <TableCell label={t('documents:fileTable.columns.actions')} className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => download.openFile(file.id, 'attachment')}
                        title={t('documents:fileTable.download')}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-primary-600 active:scale-95 transition-all cursor-pointer"
                      >
                        <DownloadIcon className="h-3.5 w-3.5" />
                      </button>
                      <Dropdown
                        align="right"
                        trigger={({ toggle }) => (
                          <button
                            onClick={toggle}
                            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            aria-label={t('documents:fileTable.optionsAria')}
                          >
                            <MoreVerticalIcon className="h-4 w-4" />
                          </button>
                        )}
                      >
                        {({ close }) => (
                          <div className="w-48 py-1.5 shadow-md">
                            <DropdownItem
                              onClick={() => {
                                download.openFile(file.id, 'attachment');
                                close();
                              }}
                            >
                              <DownloadIcon className="h-4 w-4" /> {t('documents:fileTable.download')}
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => {
                                onShare(file);
                                close();
                              }}
                            >
                              <ShareIcon className="h-4 w-4 text-primary-600" /> {t('documents:fileTable.share')}
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => {
                                onVersionHistory(file);
                                close();
                              }}
                            >
                              <ClockIcon className="h-4 w-4" /> {t('documents:fileTable.versionHistory')}
                            </DropdownItem>
                            <DropdownItem
                              className="text-rose-600 hover:bg-rose-50"
                              onClick={() => {
                                setDeleting(file);
                                close();
                              }}
                            >
                              <TrashIcon className="h-4 w-4" /> {t('documents:fileTable.delete')}
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

      {/* Floating Action Bar (Thanh công cụ nổi ở giữa lề dưới màn hình khi có tệp được tích chọn) */}
      {selectedFileIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-slate-200/90 bg-white/95 px-5 py-2.5 text-slate-800 shadow-2xl shadow-slate-300/60  transition-all animate-slide-up">
            <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
              <span className="flex min-w-[20px] h-5 px-1.5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white shadow-2xs leading-none">
                {selectedFileIds.length}
              </span>
              <span className="text-xs font-bold text-slate-700">{t('documents:fileTable.selectedLabel')}</span>
            </div>

            <button
              type="button"
              onClick={handleBatchDownload}
              className="flex items-center gap-1.5 rounded-xl bg-slate-100/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-primary-50 hover:text-primary-600 transition-colors cursor-pointer"
            >
              <DownloadIcon className="h-4 w-4 text-primary-600" />
              <span>{t('documents:fileTable.batchDownload')}</span>
            </button>

            <button
              type="button"
              onClick={() => setBatchDeleting(selectedFileIds)}
              className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors cursor-pointer"
            >
              <TrashIcon className="h-4 w-4" />
              <span>{t('documents:fileTable.batchDelete')}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFileIds([])}
              className="ml-1 text-xs font-medium text-slate-400 hover:text-slate-600 hover:underline transition-colors cursor-pointer"
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
