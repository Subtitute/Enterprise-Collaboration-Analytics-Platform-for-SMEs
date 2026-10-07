import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { UploadIcon, FileIcon, XIcon, AlertCircleIcon } from '@/components/ui/Icons';
import { formatBytes, cn } from '@/lib/utils';
import { useUploadFile } from '../hooks';
import { MAX_UPLOAD_SIZE_BYTES, validateUploadFile } from '../api';

export function UploadModal({
  folderId,
  open,
  onClose,
  initialFile = null,
}: {
  folderId: string | null;
  open: boolean;
  onClose: () => void;
  initialFile?: File | null;
}) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(initialFile);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadFile(folderId);

  useEffect(() => {
    if (initialFile) {
      setFile(initialFile);
      setFileError(validateUploadFile(initialFile));
    }
  }, [initialFile]);

  function selectFile(next: File) {
    setFile(next);
    setFileError(validateUploadFile(next));
  }

  // 26/08/2026: bo nhanh kiem tra "if (upload.isPending) return" o day (Fix 7 hom qua) - gio
  // Modal.tsx tu chan ca 3 duong dong (nut X, Escape, click ra ngoai overlay) qua prop
  // preventCloseWhilePending truyen ben duoi, nen handleClose CHI con lo phan rieng cua modal
  // nay: don dep state file/loi/tien do truoc khi dong.
  function handleClose() {
    setFile(null);
    setFileError(null);
    setProgress(0);
    onClose();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) selectFile(dropped);
  }

  function handleSubmit() {
    if (!file || fileError) return;
    upload.mutate({ file, onProgress: setProgress }, { onSuccess: handleClose });
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      preventCloseWhilePending={upload.isPending}
      title={t('documents:uploadModal.title')}
    >
      <div className="space-y-4">
        {!file ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            // 25/07/2026: them role="button" + tabIndex + onKeyDown (Enter/Space) - truoc ban sua
            // nay vung tha tep chi co onClick tren 1 the <div> thuong nen KHONG the tab-toi hay
            // kich hoat bang ban phim (khong nam trong luong tab tu nhien, trinh doc man hinh cung
            // khong bao day la 1 nut co the bam). Gan role="button" de bao dung ngu nghia, tabIndex
            // ={0} de dua vao luong Tab, onKeyDown de Enter/Space kich hoat giong hanh vi <button>
            // that (can preventDefault cho Space de trang khong bi cuon xuong).
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-radius-lg border border-dashed px-6 py-10 text-center transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-accent-soft',
              isDragOver ? 'border-accent bg-accent-soft/60' : 'border-border-strong hover:border-accent hover:bg-bg-subtle',
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-radius-md bg-accent-soft text-accent">
              <UploadIcon className="h-5 w-5 stroke-1.5" />
            </div>
            <p className="text-[13px] font-medium text-text-primary">{t('documents:uploadModal.dropHint')}</p>
            <p className="text-[12px] font-mono text-text-tertiary tabular-nums">
              {t('documents:uploadModal.supportedTypes', { maxSize: formatBytes(MAX_UPLOAD_SIZE_BYTES) })}
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) selectFile(selected);
              }}
            />
          </div>
        ) : (
          <div className={cn('rounded-radius-md border p-4', fileError ? 'border-[#B3261E]/30 bg-[#F8E5E3]/40' : 'border-border-subtle bg-white')}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-radius-md bg-bg-subtle text-text-secondary">
                <FileIcon className={cn('h-5 w-5 stroke-1.5', fileError ? 'text-[#B3261E]' : 'text-text-secondary')} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-text-primary">{file.name}</p>
                <p className="text-[12px] font-mono text-text-tertiary tabular-nums">{formatBytes(file.size)}</p>
              </div>
              {!upload.isPending && (
                <button
                  onClick={() => {
                    setFile(null);
                    setFileError(null);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-radius-sm text-text-tertiary hover:bg-[#F8E5E3] hover:text-[#B3261E] transition-colors"
                  aria-label={t('documents:uploadModal.removeFileAria')}
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            {fileError && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#B3261E]">
                <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" /> {fileError}
              </p>
            )}
            {upload.isPending && (
              <div className="mt-3">
                <ProgressBar value={progress} showLabel />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={upload.isPending} className="h-9 rounded-radius-sm border-border-strong text-[13px]">
            {t('documents:uploadModal.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!file || Boolean(fileError)} isLoading={upload.isPending} className="h-9 rounded-radius-sm bg-text-primary hover:bg-black text-[13px] font-medium">
            {t('documents:uploadModal.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
