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
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-lg shadow-slate-200/50">
      <p className="mb-1.5 font-semibold text-slate-800">{formatDate(label)}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-slate-600 py-0.5">
          <span className="h-2 w-2 rounded-full shadow-sm" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-bold text-slate-900">{p.value}</span>
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
            <defs>
              {/* Gradient nhạt tạo chiều sâu cho đường Hoàn thành (Xanh lá) */}
              <linearGradient id="trendCompletedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              {/* Gradient nhạt tạo chiều sâu cho đường Tạo mới (Vàng) */}
              <linearGradient id="trendCreatedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            {/* Grid ngang mờ thanh lịch chuẩn stroke-slate-100 */}
            <CartesianGrid stroke="#f1f5f9" vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatShortDate(v)}
              tick={{ fill: '#64748b', fontSize: 12 }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
              dy={6}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, 'dataMax + 2']}
              tick={{ fill: '#64748b', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            <Tooltip content={<ChartTooltip />} />
            {hasCreated && <Legend wrapperStyle={{ fontSize: 12, color: '#475569', paddingTop: '8px' }} iconType="circle" iconSize={8} />}

            <Area
              type="monotone"
              dataKey="completed"
              name={t('dashboard:taskTrendChart.completedLine')}
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#trendCompletedGradient)"
              dot={{ r: 3, strokeWidth: 2, fill: '#ffffff', stroke: '#10b981' }}
              activeDot={{ r: 5, strokeWidth: 2, fill: '#10b981', stroke: '#ffffff' }}
            />
            {hasCreated && (
              <Area
                type="monotone"
                dataKey="created"
                name={t('dashboard:taskTrendChart.createdLine')}
                stroke="#f59e0b"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#trendCreatedGradient)"
                dot={{ r: 3, strokeWidth: 2, fill: '#ffffff', stroke: '#f59e0b' }}
                activeDot={{ r: 5, strokeWidth: 2, fill: '#f59e0b', stroke: '#ffffff' }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </QueryState>
  );
}
