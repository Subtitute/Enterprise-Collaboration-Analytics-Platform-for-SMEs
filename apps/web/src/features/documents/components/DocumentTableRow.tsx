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
  onPreview?: (file: FileItem) => void;
  onDownload: (id: string, disposition: 'inline' | 'attachment') => void;
  onShare: (file: FileItem) => void;
  onVersionHistory: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
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
          // 22/07/2026: goi onDownload/openFile(id, 'inline') dong bo ngay trong onClick de tab moi
          // khong bi popup blocker chan.
          onClick={() => onDownload(file.id, 'inline')}
          title={t('documents:fileTable.openFileTitle')}
          className="flex min-w-0 items-center gap-3 text-left transition-colors cursor-pointer"
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
            onClick={() => onDownload(file.id, 'attachment')}
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
                {onPreview && (
                  <DropdownItem
                    className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                    onClick={() => {
                      onPreview(file);
                      close();
                    }}
                  >
                    <EyeIcon className="h-4 w-4 text-text-secondary" /> {t('documents:fileTable.viewFile', 'Xem tệp')}
                  </DropdownItem>
                )}
                <DropdownItem
                  className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                  onClick={() => {
                    onDownload(file.id, 'attachment');
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
                    onDelete(file);
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
});

