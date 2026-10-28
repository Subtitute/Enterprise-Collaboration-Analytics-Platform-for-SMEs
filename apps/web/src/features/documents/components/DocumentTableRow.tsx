import React from 'react';
import { useTranslation } from 'react-i18next';
import { TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { DownloadIcon, FileIcon, MoreVerticalIcon, ShareIcon, ClockIcon, TrashIcon, EyeIcon } from '@/components/ui/Icons';
import { formatBytes, formatDateTime } from '@/lib/utils';
import type { FileItem } from '@/types';
import { getFileTypeTheme } from './DocumentCard';

export interface DocumentTableRowProps {
  file: FileItem;
  isSelected: boolean;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  // 27/10/2026: onPreview bat buoc - bam ten tep/"Xem tệp" luon mo FilePreviewModal (khong mo tab
  // moi nua); onDownload chi con tai xuong (attachment).
  onPreview: (file: FileItem) => void;
  onDownload: (id: string) => void;
  onShare: (file: FileItem) => void;
  onVersionHistory: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  // 26/10/2026: an chia se/xoa khi nguoi goi chi xem (cay toan cong ty) - xem writeAccess.ts.
  canWrite?: boolean;
}

export const DocumentTableRow = React.memo(function DocumentTableRow({
  file,
  isSelected,
  onToggleSelect,
  onPreview,
  onDownload,
  onShare,
  onVersionHistory,
  onDelete,
  canWrite = true,
}: DocumentTableRowProps) {
  const { t } = useTranslation();
  const theme = getFileTypeTheme(file.name);

  return (
    <TableRow className={`group ${isSelected ? 'bg-accent-soft/30' : ''}`}>
      <TableCell className="w-10">
        <input
          type="checkbox"
          checked={isSelected}
          onClick={(e) => onToggleSelect(file.id, e)}
          onChange={() => {}}
          className="h-4 w-4 rounded-radius-sm border-border-strong text-accent focus:ring-accent-soft cursor-pointer"
          aria-label={t('documents:fileTable.selectFileAria', { name: file.name })}
        />
      </TableCell>
      <TableCell label={t('documents:fileTable.columns.name')}>
        <button
          type="button"
          // 27/10/2026: mo FilePreviewModal thay cho tab moi disposition=inline (ghi chu popup blocker
          // 22/07/2026 khong con ap dung o day) - .txt/.csv bi server ep attachment, Office trinh duyet
          // khong hien duoc nen tab moi chi lam tep bi tai ve.
          // 28/10/2026: them max-w-full - <button> co width theo noi dung nen ten tep dai (tai lieu that
          // trong kho) day hang rong qua man hinh 390px (trang cuon ngang ~20px), `truncate` khong co tac dung.
          onClick={() => onPreview(file)}
          title={t('documents:fileTable.openFileTitle')}
          className="flex min-w-0 max-w-full items-center gap-3 text-left transition-colors cursor-pointer"
        >
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-radius-md ${theme.bg}`}>
            <FileIcon className="h-5 w-5 stroke-1.5" />
          </span>
          <span className="truncate text-[13px] font-medium text-text-primary hover:text-accent transition-colors">
            {file.name}
          </span>
        </button>
      </TableCell>
      <TableCell label={t('documents:fileTable.columns.size')} className="whitespace-nowrap font-mono text-[12px] text-text-tertiary tabular-nums">
        {formatBytes(file.size)}
      </TableCell>
      <TableCell label={t('documents:fileTable.columns.version')}>
        <Badge variant="outline" className="font-mono text-[11px] tabular-nums">
          v{file.version ?? 1}
        </Badge>
      </TableCell>
      <TableCell label={t('documents:fileTable.columns.updated')} className="whitespace-nowrap font-mono text-[12px] text-text-tertiary tabular-nums">
        {formatDateTime(file.updatedAt)}
      </TableCell>
      <TableCell label={t('documents:fileTable.columns.actions')} className="text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onDownload(file.id)}
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
              <div className="min-w-[200px] p-1 rounded-radius-md border border-border-subtle bg-white shadow-md text-left">
                <DropdownItem
                  className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                  onClick={() => {
                    onPreview(file);
                    close();
                  }}
                >
                  <EyeIcon className="h-4 w-4 text-text-secondary" /> {t('documents:fileTable.viewFile')}
                </DropdownItem>
                <DropdownItem
                  className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                  onClick={() => {
                    onDownload(file.id);
                    close();
                  }}
                >
                  <DownloadIcon className="h-4 w-4 text-text-secondary" /> {t('documents:fileTable.download')}
                </DropdownItem>
                {canWrite && (
                  <DropdownItem
                    className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                    onClick={() => {
                      onShare(file);
                      close();
                    }}
                  >
                    <ShareIcon className="h-4 w-4 text-text-secondary" /> {t('documents:fileTable.share')}
                  </DropdownItem>
                )}
                <DropdownItem
                  className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                  onClick={() => {
                    onVersionHistory(file);
                    close();
                  }}
                >
                  <ClockIcon className="h-4 w-4 text-text-secondary" /> {t('documents:fileTable.versionHistory')}
                </DropdownItem>
                {canWrite && (
                  <DropdownItem
                    className="h-9 px-2.5 rounded-radius-sm text-[13px] text-[#B3261E] hover:bg-[#F8E5E3]"
                    onClick={() => {
                      onDelete(file);
                      close();
                    }}
                  >
                    <TrashIcon className="h-4 w-4 text-[#B3261E]" /> {t('documents:fileTable.delete')}
                  </DropdownItem>
                )}
              </div>
            )}
          </Dropdown>
        </div>
      </TableCell>
    </TableRow>
  );
});

