import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { CATEGORICAL, CHART_INK } from '@/lib/chart-colors';
import { formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import type { TaskTrendPoint } from '@/types';

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-700">{formatDate(label)}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-slate-900">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

interface TaskTrendChartProps {
  data: TaskTrendPoint[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function TaskTrendChart({ data, isLoading, isError, onRetry }: TaskTrendChartProps) {
  const { t } = useTranslation();
  const hasCreated = data.some((d) => typeof d.created === 'number');

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
      errorTitle={t('dashboard:taskTrendChart.errorTitle')}
      errorDescription={t('dashboard:taskTrendChart.errorDescription')}
    >
      {data.length === 0 ? (
        <EmptyState title={t('dashboard:taskTrendChart.emptyTitle')} description={t('dashboard:taskTrendChart.emptyDescription')} />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatDate(v)}
              tick={{ fill: CHART_INK.muted, fontSize: 12 }}
              axisLine={{ stroke: CHART_INK.baseline }}
              tickLine={false}
            />
            <YAxis allowDecimals={false} tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
            <Tooltip content={<ChartTooltip />} />
            {hasCreated && <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} iconType="circle" iconSize={8} />}
            <Line
              type="monotone"
              dataKey="completed"
              name={t('dashboard:taskTrendChart.completedLine')}
              stroke={CATEGORICAL[0]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: CATEGORICAL[0] }}
              activeDot={{ r: 5 }}
            />
            {hasCreated && (
              <Line
                type="monotone"
                dataKey="created"
                name={t('dashboard:taskTrendChart.createdLine')}
                stroke={CATEGORICAL[1]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: CATEGORICAL[1] }}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </QueryState>
  );
}
