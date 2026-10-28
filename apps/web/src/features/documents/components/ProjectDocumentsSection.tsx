import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FileIcon, FolderIcon } from '@/components/ui/Icons';
import { formatBytes, formatRelativeTime } from '@/lib/utils';
import { useFilePreview, useProjectFilesQuery } from '../hooks';
import { getFileTypeTheme } from './DocumentCard';
import { FilePreviewModal } from './FilePreviewModal';

/**
 * 26/10/2026: muc "Tai lieu" o trang chi tiet du an - tep trong moi thu muc cua du an ma nguoi dung
 * xem duoc (GET /files?projectId=, backend tu loc dung quy tac pham vi du an). Bam ten tep = mo xem
 * (cung luong openFile() cua trang Tai lieu); "Mo thu muc" dan sang trang Tai lieu dung thu muc.
 * 27/10/2026: bam ten tep mo FilePreviewModal (useFilePreview, chung voi trang Tai lieu) thay vi tab
 * moi disposition=inline - .txt/.csv bi server ep tai ve, Word/Excel/PowerPoint trinh duyet khong hien.
 */
export const ProjectDocumentsSection = memo(function ProjectDocumentsSection({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const filesQuery = useProjectFilesQuery(projectId);
  const preview = useFilePreview();
  const files = filesQuery.data ?? [];

  return (
    <section className="rounded-radius-lg border border-border-subtle bg-white p-5">
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-text-primary">{t('documents:projectDocuments.title')}</h2>
        <p className="mt-0.5 text-[12px] text-text-tertiary">{t('documents:projectDocuments.subtitle')}</p>
      </div>
      {filesQuery.isLoading ? (
        <p className="text-[13px] text-text-tertiary">{t('documents:projectDocuments.loading')}</p>
      ) : filesQuery.isError ? (
        <p className="text-[13px] text-error">{t('documents:projectDocuments.error')}</p>
      ) : files.length === 0 ? (
        <p className="text-[13px] text-text-tertiary">{t('documents:projectDocuments.empty')}</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 py-2.5">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-radius-md ${getFileTypeTheme(file.name).bg}`}>
                <FileIcon className="h-4 w-4 stroke-1.5" />
              </span>
              <button
                type="button"
                onClick={() => preview.openPreview(file)}
                title={t('documents:fileTable.openFileTitle')}
                className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-text-primary hover:text-accent transition-colors cursor-pointer"
              >
                {file.name}
              </button>
              <span className="hidden shrink-0 text-[12px] text-text-tertiary sm:inline">
                <span className="font-mono tabular-nums">{formatBytes(file.size)}</span> •{' '}
                <span className="font-mono tabular-nums">{formatRelativeTime(file.updatedAt)}</span>
              </span>
              {file.folderId && (
                <Link
                  to={`/documents?folderId=${file.folderId}`}
                  title={t('documents:projectDocuments.openFolder')}
                  aria-label={t('documents:projectDocuments.openFolder')}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors"
                >
                  <FolderIcon className="h-4 w-4" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <FilePreviewModal {...preview.modalProps} />
    </section>
  );
});
