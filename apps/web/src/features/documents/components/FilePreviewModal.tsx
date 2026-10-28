import { useCallback, useEffect, useState, useMemo, memo, lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DownloadIcon, FileIcon, AlertCircleIcon } from '@/components/ui/Icons';
import { formatBytes } from '@/lib/utils';
import { getDownloadUrl } from '../api';
import type { FileItem } from '@/types';
// 27/10/2026: xem truoc Word/Excel/PowerPoint ngay trong trinh duyet - phan loai dinh dang + nguong
// dung luong tach sang preview/preview-type.ts, trang thai tai dung chung o preview/PreviewLoading.tsx.
import {
  detectPreviewType,
  isOfficePreview,
  maxPreviewBytes,
  MAX_OFFICE_PREVIEW_SIZE_BYTES,
  type OfficePreviewProps,
  type OfficePreviewType,
} from './preview/preview-type';
import { PreviewLoading, PreviewLoadingOverlay } from './preview/PreviewLoading';

interface FilePreviewModalProps {
  file: FileItem | null;
  open: boolean;
  onClose: () => void;
  onDownload: (fileId: string) => void;
}

// 27/10/2026: 3 trinh xem Office nap lazy (React.lazy + dynamic import) -> docx-preview, SheetJS va
// bo giai nen pptx nam o chunk rieng, chi tai khi mo dung loai tep. Ung dung chua co ErrorBoundary nen
// neu chunk tai loi (mang/ban build moi) thi thay bang component bao loi -> modal hien giao dien loi
// san co, khong lam sap ca trang.
function ChunkLoadFailed({ onError }: OfficePreviewProps) {
  useEffect(() => {
    onError();
  }, [onError]);
  return null;
}

function lazyOfficePreview(load: () => Promise<{ default: ComponentType<OfficePreviewProps> }>) {
  return lazy(() => load().catch(() => ({ default: ChunkLoadFailed })));
}

const OFFICE_PREVIEWS: Record<OfficePreviewType, ComponentType<OfficePreviewProps>> = {
  docx: lazyOfficePreview(() => import('./preview/DocxPreview')),
  xlsx: lazyOfficePreview(() => import('./preview/XlsxPreview')),
  pptx: lazyOfficePreview(() => import('./preview/PptxPreview')),
};

/** 27/10/2026: tai noi dung Office ve dang nhi phan, tu choi som neu Content-Length vuot nguong. */
async function readOfficeBody(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_OFFICE_PREVIEW_SIZE_BYTES) throw new Error('Office file too large to preview');
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_OFFICE_PREVIEW_SIZE_BYTES) throw new Error('Office file too large to preview');
  return new Uint8Array(buf);
}

export const FilePreviewModal = memo(function FilePreviewModal({ file, open, onClose, onDownload }: FilePreviewModalProps) {
  const { t } = useTranslation();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  // 27/10/2026: doi ten isLoadingText -> isLoadingContent (dung chung cho text/csv va tep Office).
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [officeData, setOfficeData] = useState<Uint8Array | null>(null);
  const [hasRenderError, setHasRenderError] = useState(false);

  // Phân loại định dạng dựa trên mime_type thực tế hoặc fallback extension
  const previewType = useMemo(() => detectPreviewType(file), [file]);
  const maxBytes = maxPreviewBytes(previewType);

  const isOverSize = Boolean(file?.size && file.size > maxBytes);

  // 27/10/2026: callback on dinh cho trinh xem Office (nam trong deps cua effect phan tich tep).
  const handleRenderError = useCallback(() => setHasRenderError(true), []);
  const handleDownload = useCallback(() => {
    if (file) onDownload(file.id);
  }, [file, onDownload]);

  // Lấy download URL inline khi mở modal
  useEffect(() => {
    if (!open || !file) {
      setDownloadUrl(null);
      setTextContent(null);
      setOfficeData(null);
      setUrlError(null);
      setHasRenderError(false);
      return;
    }

    // 27/10/2026: doi tep khi modal dang mo -> xoa noi dung/loi cua tep truoc.
    setTextContent(null);
    setOfficeData(null);
    setHasRenderError(false);
    // 28/10/2026: dong modal khi tep truoc con dang tai thi .finally() cua lan do bi chan boi isMounted
    // -> co isLoading* ket o true va tep mo sau (PDF, anh, tep khong ho tro) chi hien spinner mai mai.
    setIsLoadingUrl(false);
    setIsLoadingContent(false);

    if (isOverSize || previewType === 'unsupported') {
      return;
    }

    let isMounted = true;
    // 28/10/2026: huy luon luot tai noi dung (tep Office toi 15MB) khi dong modal/doi tep giua chung.
    const controller = new AbortController();
    setIsLoadingUrl(true);
    setUrlError(null);

    getDownloadUrl(file.id, 'inline')
      .then((url) => {
        if (!isMounted) return;
        setDownloadUrl(url);

        // Nếu là text, csv hoặc Office thì fetch nội dung để render an toàn
        // 27/10/2026: Office tai ve dang ArrayBuffer (cung URL presigned inline, cung cach fetch nhu van ban).
        const isOffice = isOfficePreview(previewType);
        if (previewType === 'text' || previewType === 'csv' || isOffice) {
          setIsLoadingContent(true);
          fetch(url, { signal: controller.signal })
            .then(async (res) => {
              if (!res.ok) throw new Error('Failed to fetch preview content');
              if (isOffice) {
                const data = await readOfficeBody(res);
                if (isMounted) setOfficeData(data);
              } else {
                const txt = await res.text();
                if (isMounted) setTextContent(txt);
              }
            })
            .catch(() => {
              if (isMounted) setHasRenderError(true);
            })
            .finally(() => {
              if (isMounted) setIsLoadingContent(false);
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
      controller.abort();
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

  const OfficePreview = isOfficePreview(previewType) ? OFFICE_PREVIEWS[previewType] : null;

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
          {/* 28/10/2026: man hinh hep (< sm) chu "Tải xuống" bi an -> nut chi con icon, gan aria-label/title
              de trinh doc man hinh va nguoi dung van biet nut lam gi. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDownload(file.id)}
            aria-label={t('documents:preview.download')}
            title={t('documents:preview.download')}
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
        {(isLoadingUrl || isLoadingContent) && <PreviewLoading />}

        {/* Lỗi tải file hoặc render */}
        {!isLoadingUrl && !isLoadingContent && (urlError || hasRenderError) && (
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
          !isLoadingContent &&
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
                  {/* 27/10/2026: nguong theo loai tep (Office 15MB, con lai 20MB). */}
                  {isOverSize
                    ? t('documents:preview.fileTooLargeDesc', { maxSize: `${maxBytes / (1024 * 1024)}MB` })
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
          !isLoadingContent &&
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
          !isLoadingContent &&
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

        {/* 27/10/2026: Render Word/Excel/PowerPoint (chunk lazy, key theo tep de reset trang thai khi doi tep) */}
        {!isLoadingUrl &&
          !isLoadingContent &&
          !urlError &&
          !hasRenderError &&
          !isOverSize &&
          OfficePreview &&
          officeData && (
            <Suspense fallback={<PreviewLoadingOverlay />}>
              <OfficePreview key={file.id} data={officeData} onError={handleRenderError} onDownload={handleDownload} />
            </Suspense>
          )}
      </div>
    </Modal>
  );
});
