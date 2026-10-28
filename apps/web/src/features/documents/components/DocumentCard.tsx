import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { DownloadIcon, FileIcon, MoreVerticalIcon, ShareIcon, ClockIcon, TrashIcon } from '@/components/ui/Icons';
import { formatBytes, formatDateTime } from '@/lib/utils';
import type { FileItem } from '@/types';

// Phân loại màu sắc icon theo spec:
// PDF: file-text — error #B3261E
// Word/Doc: file-text — info #1E5A8A
// Excel/CSV: file-spreadsheet — success #2F6F44
// Image: image — accent #0E5E5E
// Khác: file — text-secondary
export function getFileTypeTheme(filename: string) {
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

export interface DocumentCardProps {
  file: FileItem;
  isSelected: boolean;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  // 27/10/2026: onPreview bat buoc, bo nhanh du phong mo tab moi disposition=inline - bam ten tep luon
  // mo FilePreviewModal (cung DocumentTableRow); onDownload chi con tai xuong (attachment).
  onPreview: (file: FileItem) => void;
  onDownload: (id: string) => void;
  onShare: (file: FileItem) => void;
  onVersionHistory: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  // 26/10/2026: an chia se/xoa khi nguoi goi chi xem (cay toan cong ty) - xem writeAccess.ts.
  canWrite?: boolean;
}

export const DocumentCard = React.memo(function DocumentCard({
  file,
  isSelected,
  onToggleSelect,
  onPreview,
  onDownload,
  onShare,
  onVersionHistory,
  onDelete,
  canWrite = true,
}: DocumentCardProps) {
  const { t } = useTranslation();
  const theme = getFileTypeTheme(file.name);

  return (
    <div
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
            onClick={(e) => onToggleSelect(file.id, e)}
            onChange={() => {}}
            className="h-4 w-4 rounded-radius-sm border-border-strong text-accent focus:ring-accent-soft cursor-pointer"
            aria-label={t('documents:fileTable.selectFileAria', { name: file.name })}
          />
          <button
            type="button"
            onClick={() => onPreview(file)}
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
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2 text-[11px] font-mono text-text-tertiary tabular-nums">
        <span>{t('documents:fileTable.updatedLabel', { date: formatDateTime(file.updatedAt) })}</span>
      </div>
    </div>
  );
});

