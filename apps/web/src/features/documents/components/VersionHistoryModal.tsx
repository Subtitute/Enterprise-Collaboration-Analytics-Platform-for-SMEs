import { useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClockIcon, UploadIcon } from '@/components/ui/Icons';
import { formatBytes, formatDateTime } from '@/lib/utils';
import { toast } from '@/stores/toast.store';
import { useFileQuery, useUploadNewVersion } from '../hooks';
import { validateUploadFile } from '../api';
import type { FileItem } from '@/types';

export const VersionHistoryModal = memo(function VersionHistoryModal({ file, folderId, onClose }: { file: FileItem | null; folderId: string | null; onClose: () => void }) {
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
              e.target.value = '';
              if (!selected || !file) return;
              // 26/08/2026: Fix 7 - kiem tra validateUploadFile() TRUOC khi goi mutate() - truoc
              // ban sua nay luong tai phien ban moi o day BO QUA hoan toan buoc kiem tra loai
              // tep/kich thuoc ma UploadModal.tsx (tai tep MOI, khac file) da lam, nen 1 tep khong
              // hop le (vd .exe, hoac > 25MB) van duoc gui thang len server thay vi bao loi ngay
              // tren client - server van tu choi (400) nhung nguoi dung phai doi round-trip mang
              // thay vi duoc bao ngay, dung cung 1 toast.error() pattern nhu cac loi khac trong
              // features/documents/hooks.ts.
              const error = validateUploadFile(selected);
              if (error) {
                toast.error(t('documents:versionHistoryModal.invalidFileTitle'), error);
                return;
              }
              uploadVersion.mutate({ file: selected });
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
                  {/* 26/08/2026: Fix 7 - bo hien thi v.uploadedByName - da doi chieu FileVersion
                      entity (apps/document-service/src/entities/file-version.entity.ts) va
                      FilesService (findOne()/uploadNewVersion()): backend CHI luu/tra ve
                      uploadedByUserId (UUID tho), KHONG join sang ten nguoi dung nao ca - truong
                      nay LUON la undefined tren FE (mapFileVersion() trong api.ts cung khong map
                      no), nen dieu kien `v.uploadedByName ? ... : ''` truoc day la code chet, khong
                      bao gio hien duoc gi. Se bo sung lai neu sau nay backend co API/join tra ve
                      ten nguoi tai len. */}
                  <p className="text-xs text-slate-400">{formatDateTime(v.createdAt)}</p>
                </div>
                {v.size !== undefined && <span className="text-xs text-slate-400">{formatBytes(v.size)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
});
