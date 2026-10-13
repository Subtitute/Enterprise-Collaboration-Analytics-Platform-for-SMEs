import React, { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { CATEGORICAL, CHART_INK } from '@/lib/chart-colors';
import { formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import type { DocumentActivityPoint } from '@/types';

function ActivityTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-radius-md border border-border-subtle bg-surface px-3 py-2 text-xs shadow-none">
      <p className="mb-1 font-mono font-medium text-text-primary tabular-nums">{formatDate(label)}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-text-secondary">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-mono font-medium text-text-primary tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

interface DocumentActivityChartProps {
  data: DocumentActivityPoint[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export const DocumentActivityChart = React.memo(function DocumentActivityChart({
  data,
  isLoading,
  isError,
  onRetry,
}: DocumentActivityChartProps) {
  const { t } = useTranslation();
  const hasShares = useMemo(() => data.some((d) => typeof d.shares === 'number'), [data]);

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      loadingFallback={
        <div className="flex h-[280px] items-center justify-center">
          <Spinner />
        </div>
      }
      errorTitle={t('analytics:documentActivityChart.errorTitle')}
      errorDescription={t('analytics:documentActivityChart.errorDescription')}
    >
      {data.length === 0 ? (
        <EmptyState title={t('analytics:documentActivityChart.emptyTitle')} />
      ) : (
        <div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="doc-activity-uploads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0E5E5E" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#0E5E5E" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e1e0d9" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatDate(v)}
              tick={{ fill: CHART_INK.muted, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
              axisLine={{ stroke: CHART_INK.baseline }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: CHART_INK.muted, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip content={<ActivityTooltip />} />
            <Area
              type="monotone"
              dataKey="uploads"
              name={t('analytics:documentActivityChart.uploadsLabel')}
              stroke="#0E5E5E"
              strokeWidth={1.5}
              fill="url(#doc-activity-uploads)"
            />
            {hasShares && (
              <Area
                type="monotone"
                dataKey="shares"
                name={t('analytics:documentActivityChart.sharesLabel')}
                stroke="#8A8781"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Custom Legend dưới chart: giống TaskTrendChart ở Dashboard, nét liền #0E5E5E & nét đứt #8A8781 */}
        <div className="mt-2 flex items-center justify-center gap-5 text-[12px] text-text-secondary select-none">
          {/* Series 1: Đường liền màu Teal #0E5E5E */}
          <div className="flex items-center gap-2">
            <svg width="18" height="6" viewBox="0 0 18 6" className="shrink-0" aria-hidden="true">
              <line x1="0" y1="3" x2="18" y2="3" stroke="#0E5E5E" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>{t('analytics:documentActivityChart.uploadsLabel')}</span>
          </div>

          {/* Series 2: Đường gạch đứt màu #8A8781 */}
          {hasShares && (
            <div className="flex items-center gap-2">
              <svg width="18" height="6" viewBox="0 0 18 6" className="shrink-0" aria-hidden="true">
                <line
                  x1="0"
                  y1="3"
                  x2="18"
                  y2="3"
                  stroke="#8A8781"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                />
              </svg>
              <span>{t('analytics:documentActivityChart.sharesLabel')}</span>
            </div>
          )}
        </div>
      </div>
      )}
    </QueryState>
  );
});
