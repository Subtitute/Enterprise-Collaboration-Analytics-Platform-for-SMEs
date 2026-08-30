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
        'relative overflow-hidden flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-8 sm:p-12 text-center shadow-2xs',
        className,
      )}
    >
      {icon && (
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 border border-slate-100">
          <div className="text-2xl">{icon}</div>
        </div>
      )}

      <p className="text-base font-bold text-slate-900 tracking-tight">{title}</p>
      {description && <p className="max-w-md text-sm text-slate-500 leading-relaxed">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
