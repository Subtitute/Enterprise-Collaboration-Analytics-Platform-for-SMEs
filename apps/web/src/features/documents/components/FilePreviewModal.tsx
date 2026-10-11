import { useEffect, useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { DownloadIcon, XIcon, FileIcon, AlertCircleIcon } from '@/components/ui/Icons';
import { formatBytes } from '@/lib/utils';
import { getDownloadUrl } from '../api';
import type { FileItem } from '@/types';

interface FilePreviewModalProps {
  file: FileItem | null;
  open: boolean;
  onClose: () => void;
  onDownload: (fileId: string) => void;
}

// Ngưỡng dung lượng tối đa hỗ trợ xem trực tiếp (20MB)
const MAX_PREVIEW_SIZE_BYTES = 20 * 1024 * 1024;

export const FilePreviewModal = memo(function FilePreviewModal({ file, open, onClose, onDownload }: FilePreviewModalProps) {
  const { t } = useTranslation();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [hasRenderError, setHasRenderError] = useState(false);

  // Phân loại định dạng dựa trên mime_type thực tế hoặc fallback extension
  const previewType = useMemo<'pdf' | 'image' | 'text' | 'csv' | 'unsupported'>(() => {
    if (!file) return 'unsupported';
    const mime = (file.mimeType || '').toLowerCase();
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (
      mime.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)
    ) {
      return 'image';
    }
    if (mime === 'text/csv' || ext === 'csv') return 'csv';
    if (mime.startsWith('text/') || ext === 'txt') return 'text';

    return 'unsupported';
  }, [file]);

  const isOverSize = Boolean(file?.size && file.size > MAX_PREVIEW_SIZE_BYTES);

  // Lấy download URL inline khi mở modal
  useEffect(() => {
    if (!open || !file) {
      setDownloadUrl(null);
      setTextContent(null);
      setUrlError(null);
      setHasRenderError(false);
      return;
    }

    if (isOverSize || previewType === 'unsupported') {
      return;
    }

    let isMounted = true;
    setIsLoadingUrl(true);
    setUrlError(null);

    getDownloadUrl(file.id, 'inline')
      .then((url) => {
        if (!isMounted) return;
        setDownloadUrl(url);

        // Nếu là text hoặc csv thì fetch nội dung để render an toàn
        if (previewType === 'text' || previewType === 'csv') {
          setIsLoadingText(true);
          fetch(url)
            .then((res) => {
              if (!res.ok) throw new Error('Failed to fetch text content');
              return res.text();
            })
            .then((txt) => {
              if (isMounted) setTextContent(txt);
            })
            .catch(() => {
              if (isMounted) setHasRenderError(true);
            })
            .finally(() => {
              if (isMounted) setIsLoadingText(false);
            });
        }
      })
      .catch((err) => {
        if (isMounted) setUrlError(err instanceof Error ? err.message : 'Error fetching preview URL');
      })
      .finally(() => {
        if (isMounted) setIsLoadingUrl(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, file, isOverSize, previewType]);

  // Phân tích và làm sạch CSV (Chống CSV Injection: vô hiệu hóa dấu =, +, -, @)
  const parsedCsvData = useMemo<string[][]>(() => {
    if (previewType !== 'csv' || !textContent) return [];
    try {
      const lines = textContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
      return lines.map((line) => {
        // Tách theo dấu phẩy cơ bản
        const cols = line.split(',').map((c) => {
          let clean = c.trim().replace(/^["']|["']$/g, '');
          // Chống CSV formula injection
          if (/^[=+\-@\t\r]/.test(clean)) {
            clean = `'${clean}`;
          }
          return clean;
        });
        return cols;
      });
    } catch {
      return [];
    }
  }, [previewType, textContent]);

  if (!file) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center justify-between gap-3 w-full pr-6">
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold text-text-primary truncate" title={file.name}>
              {file.name}
            </h3>
            {file.size && (
              <p className="text-[12px] font-mono text-text-tertiary tabular-nums mt-0.5">{formatBytes(file.size)}</p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDownload(file.id)}
            className="shrink-0 flex items-center gap-1.5 h-8 rounded-radius-sm border-border-strong text-[12px] font-medium"
          >
            <DownloadIcon className="h-3.5 w-3.5 text-text-secondary" />
            <span className="hidden sm:inline">{t('documents:preview.download')}</span>
          </Button>
        </div>
      }
    >
      <div className="relative flex flex-col items-center justify-center min-h-[360px] h-[60vh] sm:h-[75vh] w-full bg-bg-subtle rounded-radius-md overflow-hidden border border-border-subtle">
        {/* Loading state */}
        {(isLoadingUrl || isLoadingText) && (
          <div className="flex flex-col items-center justify-center gap-3">
            <Spinner size="md" />
            <p className="text-[12px] font-medium text-text-tertiary">{t('documents:preview.loading')}</p>
          </div>
        )}

        {/* Lỗi tải file hoặc render */}
        {!isLoadingUrl && !isLoadingText && (urlError || hasRenderError) && (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-radius-md bg-[#F8E5E3] text-[#B3261E] border border-[#B3261E]/20">
              <AlertCircleIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-text-primary">{t('documents:preview.loadErrorTitle')}</p>
              <p className="text-[12px] text-text-tertiary max-w-sm mt-1">{t('documents:preview.loadErrorDesc')}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDownload(file.id)}
              className="mt-2 h-8 rounded-radius-sm border-border-strong text-[12px]"
            >
              <DownloadIcon className="h-3.5 w-3.5 mr-1.5 text-text-secondary" />
              {t('documents:preview.downloadToView')}
            </Button>
          </div>
        )}

        {/* Fallback khi tệp vượt kích thước hoặc không hỗ trợ */}
        {!isLoadingUrl &&
          !isLoadingText &&
          !urlError &&
          !hasRenderError &&
          (isOverSize || previewType === 'unsupported') && (
            <div className="flex flex-col items-center justify-center gap-3.5 p-6 text-center max-w-md">
              <div className="flex h-16 w-16 items-center justify-center rounded-radius-lg bg-bg-subtle text-text-secondary border border-border-subtle">
                <FileIcon className="h-8 w-8 stroke-1.5" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-text-primary truncate max-w-xs sm:max-w-md">{file.name}</p>
                <p className="text-[12px] text-text-secondary font-normal mt-1">
                  {isOverSize
                    ? t('documents:preview.fileTooLargeDesc', { maxSize: '20MB' })
                    : t('documents:preview.unsupportedDesc')}
                </p>
                {file.size && (
                  <span className="inline-block mt-2 rounded-radius-sm bg-bg-subtle px-2.5 py-1 text-[12px] font-mono font-medium text-text-tertiary border border-border-subtle tabular-nums">
                    {formatBytes(file.size)}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => onDownload(file.id)}
                className="mt-2 h-9 rounded-radius-sm border-border-strong text-[13px] font-medium"
              >
                <DownloadIcon className="h-4 w-4 mr-1.5 text-text-secondary" />
                {t('documents:preview.downloadToView')}
              </Button>
            </div>
          )}

        {/* Render PDF */}
        {!isLoadingUrl &&
          !urlError &&
          !hasRenderError &&
          !isOverSize &&
          previewType === 'pdf' &&
          downloadUrl && (
            <iframe
              src={`${downloadUrl}#toolbar=0`}
              title={file.name}
              className="w-full h-full border-0 bg-white"
              onError={() => setHasRenderError(true)}
            />
          )}

        {/* Render Image */}
        {!isLoadingUrl &&
          !urlError &&
          !hasRenderError &&
          !isOverSize &&
          previewType === 'image' &&
          downloadUrl && (
            <div className="w-full h-full flex items-center justify-center p-4 bg-slate-950/5 overflow-auto">
              <img
                src={downloadUrl}
                alt={file.name}
                className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                onError={() => setHasRenderError(true)}
              />
            </div>
          )}

        {/* Render Text */}
        {!isLoadingUrl &&
          !isLoadingText &&
          !urlError &&
          !hasRenderError &&
          !isOverSize &&
          previewType === 'text' && (
            <div className="w-full h-full p-4 overflow-auto bg-white">
              <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                {textContent}
              </pre>
            </div>
          )}

        {/* Render CSV */}
        {!isLoadingUrl &&
          !isLoadingText &&
          !urlError &&
          !hasRenderError &&
          !isOverSize &&
          previewType === 'csv' && (
            <div className="w-full h-full overflow-auto bg-white p-3">
              {parsedCsvData.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8 italic">
                  {t('documents:preview.emptyContent')}
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <tbody>
                    {parsedCsvData.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={
                          rIdx === 0
                            ? 'bg-slate-50 font-bold text-slate-800 border-b border-slate-200'
                            : 'border-b border-slate-100 hover:bg-slate-50/60 text-slate-600'
                        }
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-2 border-r border-slate-100 last:border-r-0 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
      </div>
    </Modal>
  );
});
