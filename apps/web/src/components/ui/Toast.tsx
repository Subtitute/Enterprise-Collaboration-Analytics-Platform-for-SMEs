import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '@/stores/toast.store';
import type { ToastItem, ToastVariant } from '@/stores/toast.store';
import { useUIStore } from '@/stores/ui.store';
import type { ChatbotLayer } from '@/stores/ui.store';
import { cn } from '@/lib/utils';

const variantClasses: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-primary-200 bg-primary-50 text-primary-800',
};

function ToastCard({ item }: { item: ToastItem }) {
  const { t } = useTranslation();
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), 4500);
    return () => clearTimeout(timer);
  }, [item.id, dismiss]);

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto w-80 max-w-[calc(100vw-2rem)] animate-slide-up rounded-lg border px-4 py-3 shadow-lg',
        variantClasses[item.variant],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{item.title}</p>
        <button onClick={() => dismiss(item.id)} aria-label={t('common:toast.dismiss')} className="shrink-0 text-current/60 hover:text-current">
          ×
        </button>
      </div>
      {item.description && <p className="mt-0.5 text-xs opacity-90">{item.description}</p>}
    </div>
  );
}

// 24/10/2026: vi tri cum toast theo lop noi cua Chat bot noi bo (xem ChatbotLayer, ui.store.ts) - nut
// chat chiem goc duoi-phai (mobile: bottom-24..9rem, sm+: bottom-5..4.25rem), panel chat (sm+) rong
// 380px cach le phai 1.25rem -> day toast len tren nut / sang trai panel de khong che len nhau.
// 24/10/2026 (ra soat cuoi): man hinh < 640px panel chiem gan tron chieu ngang (top 4.5rem -> bottom
// 10rem) nen 'bottom-40' cu day toast len NGAY TREN noi dung panel - doi sang mep TREN man hinh (de len
// Topbar, vua 1 toast truoc moc 4.5rem cua panel); sm+ giu nguyen ben trai panel.
const TOAST_POSITION_CLASSES: Record<ChatbotLayer, string> = {
  none: 'bottom-4 right-4',
  launcher: 'bottom-40 right-4 sm:bottom-20',
  panel: 'top-2 left-4 right-4 items-end sm:top-auto sm:left-auto sm:items-stretch sm:bottom-20 sm:right-[26rem]',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const chatbotLayer = useUIStore((s) => s.chatbotLayer);
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={cn('pointer-events-none fixed z-[100] flex flex-col gap-2', TOAST_POSITION_CLASSES[chatbotLayer])}>
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>,
    document.body,
  );
}
