import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { formatDate, formatShortDate } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import type { TaskTrendPoint } from '@/types';

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-xs">
      <p className="mb-1 font-semibold text-slate-800">{formatDate(label)}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-slate-600 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-mono font-bold text-slate-900 tabular-nums">{p.value}</span>
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
          <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            {/* Grid ngang siêu mảnh chỉ vẽ đường ngang */}
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatShortDate(v)}
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, 'dataMax + 2']}
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip content={<ChartTooltip />} />
            {hasCreated && <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: '8px' }} iconType="circle" iconSize={6} />}

            <Area
              type="monotone"
              dataKey="completed"
              name={t('dashboard:taskTrendChart.completedLine')}
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={0.06}
              fill="#10b981"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 1.5, fill: '#10b981', stroke: '#ffffff' }}
            />
            {hasCreated && (
              <Area
                type="monotone"
                dataKey="created"
                name={t('dashboard:taskTrendChart.createdLine')}
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={0.06}
                fill="#f59e0b"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 1.5, fill: '#f59e0b', stroke: '#ffffff' }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </QueryState>
  );
}
