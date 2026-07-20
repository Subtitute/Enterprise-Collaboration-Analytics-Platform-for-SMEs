import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  accentClassName?: string;
  isLoading?: boolean;
}

export function KpiCard({ label, value, hint, icon, accentClassName, isLoading }: KpiCardProps) {
  return (
    <Card className="flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        {isLoading ? (
          <div className="mt-2 h-7 w-16 animate-pulse rounded bg-slate-100" />
        ) : (
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
        )}
        {hint && <p className="mt-1 truncate text-xs text-slate-400">{hint}</p>}
      </div>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', accentClassName ?? 'bg-primary-50 text-primary-600')}>
        {icon}
      </div>
    </Card>
  );
}
