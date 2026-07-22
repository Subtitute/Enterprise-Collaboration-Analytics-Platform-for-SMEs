import type { ReactNode } from 'react';
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
}

export function KpiCard({ label, value, hint, icon, accentClassName, isLoading, isError, onRetry }: KpiCardProps) {
  return (
    <Card className="flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        {isError ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <AlertCircleIcon className="h-4 w-4 shrink-0 text-rose-500" />
            <span className="text-sm text-rose-500">Lỗi tải dữ liệu</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                aria-label={`Thử lại tải ${label}`}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : isLoading ? (
          <div className="mt-2 h-7 w-16 animate-pulse rounded bg-slate-100" />
        ) : (
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
        )}
        {hint && !isError && <p className="mt-1 truncate text-xs text-slate-400">{hint}</p>}
      </div>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', accentClassName ?? 'bg-primary-50 text-primary-600')}>
        {icon}
      </div>
    </Card>
  );
}
