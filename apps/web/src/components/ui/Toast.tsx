import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToastStore } from '@/stores/toast.store';
import type { ToastItem, ToastVariant } from '@/stores/toast.store';
import { cn } from '@/lib/utils';

const variantClasses: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-primary-200 bg-primary-50 text-primary-800',
};

function ToastCard({ item }: { item: ToastItem }) {
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
        <button onClick={() => dismiss(item.id)} aria-label="Đóng thông báo" className="shrink-0 text-current/60 hover:text-current">
          ×
        </button>
      </div>
      {item.description && <p className="mt-0.5 text-xs opacity-90">{item.description}</p>}
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>,
    document.body,
  );
}
