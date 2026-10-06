import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { formatDate, formatShortDate } from '@/lib/utils';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import type { TaskTrendPoint } from '@/types';

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-radius-sm bg-[#1C1B1A] text-[#F7F6F3] px-2.5 py-2 text-[12px] font-medium shadow-sm">
      <p className="mb-1 text-[11px] text-[#A8A29E]">{formatDate(label)}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-mono font-semibold text-white">{p.value}</span>
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

  // Kiểm tra 0 data hoặc mảng rỗng
  const isEmpty = data.length === 0 || data.every((d) => (d.created || 0) === 0 && (d.completed || 0) === 0);

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
      <div className="relative w-full" aria-label="Biểu đồ xu hướng hoàn thành công việc">
        {isEmpty && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span className="text-[13px] text-text-tertiary bg-bg-surface/80 px-3 py-1.5 rounded">
              {t('dashboard:taskTrendChart.emptyOverlay', 'Chưa có dữ liệu trong khoảng thời gian này')}
            </span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
            <defs>
              {/* Gradient dọc teal -> trong suốt, fillOpacity 0.08 */}
              <linearGradient id="trendCompletedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0E5E5E" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#0E5E5E" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            {/* Grid ngang mảnh #E7E5DF, strokeDasharray 3 3, vertical={false} */}
            <CartesianGrid stroke="#E7E5DF" vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatShortDate(v)}
              tick={{ fill: '#8A8781', fontSize: 11, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: '#8A8781', fontSize: 11, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              width={24}
            />
            <Tooltip content={<ChartTooltip />} />

            {/* Series 1 "Hoàn thành": stroke #0E5E5E (teal), strokeWidth 1.5, solid, dot={false}, area fill */}
            <Area
              type="monotone"
              dataKey="completed"
              name={t('dashboard:taskTrendChart.completedLine', 'Hoàn thành')}
              stroke="#0E5E5E"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#trendCompletedGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 1.5, fill: '#0E5E5E', stroke: '#ffffff' }}
            />

            {/* Series 2 "Được tạo mới": stroke #8A8781 (text-tertiary), strokeDasharray "4 4", strokeWidth 1.5, dot={false}, không fill */}
            {hasCreated && (
              <Area
                type="monotone"
                dataKey="created"
                name={t('dashboard:taskTrendChart.createdLine', 'Được tạo mới')}
                stroke="#8A8781"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 1.5, fill: '#8A8781', stroke: '#ffffff' }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Custom Legend dưới chart: căn giữa, đường kẻ 16px (liền/đứt) + label 12/400 text-secondary, gap 16 */}
        <div className="mt-2 flex items-center justify-center gap-5 text-[12px] text-text-secondary select-none">
          {/* Series 1: Đường liền màu Teal #0E5E5E */}
          <div className="flex items-center gap-2">
            <svg width="18" height="6" viewBox="0 0 18 6" className="shrink-0" aria-hidden="true">
              <line x1="0" y1="3" x2="18" y2="3" stroke="#0E5E5E" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>{t('dashboard:taskTrendChart.completedLine', 'Hoàn thành')}</span>
          </div>

          {/* Series 2: Đường gạch đứt màu #8A8781 */}
          {hasCreated && (
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
              <span>{t('dashboard:taskTrendChart.createdLine', 'Được tạo mới')}</span>
            </div>
          )}
        </div>
      </div>
    </QueryState>
  );
}

