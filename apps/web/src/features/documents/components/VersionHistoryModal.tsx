import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClockIcon, UploadIcon } from '@/components/ui/Icons';
import { formatBytes, formatDateTime } from '@/lib/utils';
import { useFileQuery, useUploadNewVersion } from '../hooks';
import type { FileItem } from '@/types';

export function VersionHistoryModal({ file, folderId, onClose }: { file: FileItem | null; folderId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileQuery = useFileQuery(file?.id);
  const uploadVersion = useUploadNewVersion(file?.id ?? '', folderId);
  const detail = fileQuery.data ?? file;
  const versions = detail?.versions ?? [];

  return (
    <Modal open={Boolean(file)} onClose={onClose} title={t('documents:versionHistoryModal.title', { fileName: file?.name ?? '' })} size="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{t('documents:versionHistoryModal.currentVersion', { version: detail?.version ?? 1 })}</p>
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} isLoading={uploadVersion.isPending}>
            <UploadIcon className="h-4 w-4" /> {t('documents:versionHistoryModal.uploadNewVersion')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected && file) uploadVersion.mutate({ file: selected });
              e.target.value = '';
            }}
          />
        </div>

        {fileQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : versions.length === 0 ? (
          <EmptyState
            icon={<ClockIcon className="h-8 w-8" />}
            title={t('documents:versionHistoryModal.emptyTitle')}
            description={t('documents:versionHistoryModal.emptyDescription')}
          />
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{t('documents:versionHistoryModal.versionLabel', { version: v.version })}</p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(v.createdAt)}
                    {v.uploadedByName ? ` · ${v.uploadedByName}` : ''}
                  </p>
                </div>
                {v.size !== undefined && <span className="text-xs text-slate-400">{formatBytes(v.size)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
