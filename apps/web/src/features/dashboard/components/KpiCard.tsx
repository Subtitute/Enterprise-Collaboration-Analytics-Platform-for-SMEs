import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
// 22/07/2026: them AlertCircleIcon/RefreshIcon de hien nhanh loi + nut "Thu lai" ngay trong the -
// dung lai cung 2 icon ma QueryState.tsx da dung cho pattern loi o cac noi khac trong repo.
import { AlertCircleIcon, RefreshIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  accentClassName?: string;
  isLoading?: boolean;
  /** 22/07/2026: hien nhanh loi thay vi so lieu khi query nguon bi loi (xem DashboardPage.tsx -
   *  truoc ban sua nay summaryQuery.isError bi bo qua hoan toan, 4 the KPI hien '—' mai mai khi
   *  GET /analytics/summary that bai, khong khac gi "chua co du lieu"). */
  isError?: boolean;
  /** Goi lai query khi bam nut thu lai trong the - bo qua thi nut se khong hien. */
  onRetry?: () => void;
  className?: string;
}

export function KpiCard({ label, value, hint, icon, accentClassName, isLoading, isError, onRetry, className }: KpiCardProps) {
  const { t } = useTranslation();
  return (
    <Card className={cn("group flex items-start justify-between gap-2 p-5 sm:gap-3 border-slate-200/60 bg-white shadow-sm hover:shadow-md transition-all duration-200", className)}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs sm:text-sm font-medium text-slate-500 group-hover:text-slate-700 transition-colors">{label}</p>
        {isError ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <AlertCircleIcon className="h-4 w-4 shrink-0 text-rose-500" />
            <span className="text-xs sm:text-sm text-rose-500">{t('dashboard:kpiCard.errorLabel')}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                aria-label={t('dashboard:kpiCard.retryAriaLabel', { label })}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : isLoading ? (
          <div className="mt-2 h-9 w-20 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <p className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-slate-900">{value}</p>
        )}
        {hint && !isError && <p className="mt-1 truncate text-[11px] sm:text-xs font-medium text-slate-400">{hint}</p>}
      </div>
      <div
        className={cn(
          'flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl shadow-xs transition-transform duration-200 group-hover:scale-105',
          accentClassName ?? 'bg-indigo-100 text-indigo-600',
        )}
      >
        {icon}
      </div>
    </Card>
  );
}
