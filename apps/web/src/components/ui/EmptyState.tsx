import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  plain?: boolean;
}

export function EmptyState({ icon, title, description, action, className, plain = false }: EmptyStateProps) {
  const isPlain = plain || !icon;

  return (
    <div
      className={cn(
        'relative overflow-hidden flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center',
        isPlain
          ? 'border-slate-200 bg-white/60 px-6 py-12'
          : 'border-indigo-200/80 bg-gradient-to-b from-indigo-50/30 via-slate-50/50 to-white px-6 py-14 shadow-xs',
        className,
      )}
    >
      {/* Chỉ hiện vệt sáng trang trí mờ khi có icon cụ thể */}
      {!isPlain && (
        <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-gradient-to-tr from-indigo-200/30 to-violet-200/30 blur-2xl" />
      )}

      {icon && (
        <div className="relative mb-1.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-white to-indigo-50/80 text-primary-600 shadow-md ring-1 ring-indigo-900/5 transition-transform duration-300 hover:scale-105">
          <div className="text-2xl">{icon}</div>
        </div>
      )}

      <p className="relative text-base font-bold text-slate-900 tracking-tight">{title}</p>
      {description && <p className="relative max-w-md text-sm text-slate-500 leading-relaxed">{description}</p>}
      {action && <div className="relative mt-2.5">{action}</div>}
    </div>
  );
}
