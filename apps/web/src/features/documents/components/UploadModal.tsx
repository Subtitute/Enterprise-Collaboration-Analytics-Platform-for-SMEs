import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { UploadIcon, FileIcon, XIcon } from '@/components/ui/Icons';
import { formatBytes, cn } from '@/lib/utils';
import { useUploadFile } from '../hooks';

export function UploadModal({ folderId, open, onClose }: { folderId: string | null; open: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadFile(folderId);

  function handleClose() {
    setFile(null);
    setProgress(0);
    onClose();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  function handleSubmit() {
    if (!file) return;
    upload.mutate({ file, onProgress: setProgress }, { onSuccess: handleClose });
  }

  return (
    <Modal open={open} onClose={handleClose} title="Tải lên tài liệu">
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
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
              isDragOver ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            <UploadIcon className="h-8 w-8 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">Kéo thả tệp vào đây, hoặc bấm để chọn tệp</p>
            <p className="text-xs text-slate-400">Hỗ trợ mọi định dạng tài liệu thông dụng</p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) setFile(selected);
              }}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <FileIcon className="h-8 w-8 shrink-0 text-primary-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
              </div>
              {!upload.isPending && (
                <button onClick={() => setFile(null)} className="text-slate-400 hover:text-rose-600" aria-label="Bỏ chọn tệp">
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            {upload.isPending && (
              <div className="mt-3">
                <ProgressBar value={progress} showLabel />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={upload.isPending}>
            Hủy
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!file} isLoading={upload.isPending}>
            Tải lên
          </Button>
        </div>
      </div>
    </Modal>
  );
}
