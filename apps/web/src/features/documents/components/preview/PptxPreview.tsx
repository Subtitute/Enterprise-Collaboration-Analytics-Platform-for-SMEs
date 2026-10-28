import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { DownloadIcon } from '@/components/ui/Icons';
import { extractPptxSlides, type PptxSlide } from './pptx-extract';
import { PreviewLoadingOverlay } from './PreviewLoading';
import type { OfficePreviewProps } from './preview-type';

// 27/10/2026: ban xem GIAN LUOC .pptx - moi trang chieu 1 the (so trang, tieu de, cac dong chu theo
// cap thut le). Ghi ro day la ban gian luoc + nut tai tep goc vi bo cuc/anh/bieu do khong duoc ve lai.
export default function PptxPreview({ data, onError, onDownload }: OfficePreviewProps) {
  const { t } = useTranslation();
  const [slides, setSlides] = useState<PptxSlide[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      try {
        const result = extractPptxSlides(data);
        if (!cancelled) setSlides(result);
      } catch {
        if (!cancelled) onError();
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [data, onError]);

  if (!slides) return <PreviewLoadingOverlay />;

  return (
    <div className="w-full h-full overflow-auto">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-[#FFF8E6] px-4 py-2">
        <p className="min-w-0 flex-1 text-[12px] text-text-secondary">{t('documents:preview.pptxSimplified')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDownload}
          className="shrink-0 h-7 rounded-radius-sm border-border-strong text-[12px]"
        >
          <DownloadIcon className="h-3.5 w-3.5 text-text-secondary" />
          {t('documents:preview.downloadOriginal')}
        </Button>
      </div>
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
        {slides.length === 0 ? (
          <p className="py-8 text-center text-xs italic text-slate-400">{t('documents:preview.noSlides')}</p>
        ) : (
          slides.map((slide) => (
            <section
              key={slide.index}
              className="rounded-radius-md border border-border-subtle bg-white p-4 shadow-sm"
              aria-label={t('documents:preview.slideLabel', { n: slide.index })}
            >
              <p className="text-[11px] font-semibold text-text-tertiary tabular-nums">
                {t('documents:preview.slideLabel', { n: slide.index })}
              </p>
              {slide.title && <h4 className="mt-1 text-[15px] font-semibold text-text-primary">{slide.title}</h4>}
              {slide.paragraphs.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-text-secondary">
                  {slide.paragraphs.map((paragraph, i) => (
                    <li key={i} style={{ marginLeft: `${paragraph.level * 16}px` }} className="break-words">
                      {paragraph.text}
                    </li>
                  ))}
                </ul>
              ) : (
                !slide.title && (
                  <p className="mt-2 text-[12px] italic text-text-tertiary">{t('documents:preview.slideNoText')}</p>
                )
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
