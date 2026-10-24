import { memo, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { formatDate, formatShortDate } from '@/lib/utils';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import type { TaskTrendPoint } from '@/types';

export interface TaskTrendChartPoint extends TaskTrendPoint {
  label?: string;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; payload?: TaskTrendChartPoint }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const displayLabel = point?.label ?? (label ? formatDate(label) : '');
  return (
    <div className="rounded-radius-sm bg-[#1C1B1A] text-[#F7F6F3] px-2.5 py-2 text-[12px] font-medium shadow-none border border-border-subtle">
      <p className="mb-1 text-[11px] text-[#A8A29E] font-medium">{displayLabel}</p>
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
  data: TaskTrendPoint[] | TaskTrendChartPoint[];
  range?: '7d' | '30d' | 'quarter';
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export const TaskTrendChart = memo(function TaskTrendChart({ data, range = '30d', isLoading, isError, onRetry }: TaskTrendChartProps) {
  const { t } = useTranslation();

  // Logic gom nhóm dữ liệu (Aggregation): bọc trong useMemo theo đặc tả
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Nếu các điểm đã có sẵn nhãn định dạng (đã được aggregate từ trước), tái sử dụng trực tiếp
    if (data.some((d) => (d as TaskTrendChartPoint).label)) {
      return data as TaskTrendChartPoint[];
    }

    const pad2 = (n: number) => String(n).padStart(2, '0');

    // 1. Range "7 ngày": 1 ngày / điểm. Nhãn: DD-MM (7 điểm)
    if (range === '7d') {
      const now = new Date();
      const points: TaskTrendChartPoint[] = [];
      const dataMap = new Map(data.map((d) => [d.date.slice(0, 10), d]));

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const y = d.getFullYear();
        const m = pad2(d.getMonth() + 1);
        const day = pad2(d.getDate());
        const dateKey = `${y}-${m}-${day}`;
        const item = dataMap.get(dateKey);

        points.push({
          date: dateKey,
          label: `${day}-${m}`,
          created: item?.created ?? 0,
          completed: item?.completed ?? 0,
        });
      }
      return points;
    }

    // 2. Range "30 ngày": Gom theo tuần (7 ngày / điểm -> 4 điểm). Nhãn: "DD/MM - DD/MM"
    if (range === '30d') {
      const now = new Date();
      const points: TaskTrendChartPoint[] = [];

      for (let w = 3; w >= 0; w--) {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (w * 7 + 6));
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (w * 7));

        const startStr = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`;
        const endStr = `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`;
        const label = `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)} - ${pad2(end.getDate())}/${pad2(end.getMonth() + 1)}`;

        let createdSum = 0;
        let completedSum = 0;

        for (const item of data) {
          const itemDate = item.date.slice(0, 10);
          if (itemDate >= startStr && itemDate <= endStr) {
            createdSum += item.created || 0;
            completedSum += item.completed || 0;
          }
        }

        points.push({
          date: startStr,
          label,
          created: createdSum,
          completed: completedSum,
        });
      }
      return points;
    }

    // 3. Range "Quý này" (90 ngày): Mỗi tháng thành 2 mốc (01-15 và 16-cuối tháng -> 6 điểm). Nhãn: "01-15/MM", "16-cuối/MM"
    if (range === 'quarter') {
      const now = new Date();
      const points: TaskTrendChartPoint[] = [];

      for (let mOffset = 2; mOffset >= 0; mOffset--) {
        const targetMonth = new Date(now.getFullYear(), now.getMonth() - mOffset, 1);
        const year = targetMonth.getFullYear();
        const monthNum = targetMonth.getMonth() + 1;
        const mm = pad2(monthNum);
        const lastDay = new Date(year, monthNum, 0).getDate();

        // Nửa đầu tháng: 01-15
        const p1Start = `${year}-${mm}-01`;
        const p1End = `${year}-${mm}-15`;
        let c1Created = 0;
        let c1Completed = 0;

        // Nửa cuối tháng: 16-cuối
        const p2Start = `${year}-${mm}-16`;
        const p2End = `${year}-${mm}-${pad2(lastDay)}`;
        let c2Created = 0;
        let c2Completed = 0;

        for (const item of data) {
          const itemDate = item.date.slice(0, 10);
          if (itemDate >= p1Start && itemDate <= p1End) {
            c1Created += item.created || 0;
            c1Completed += item.completed || 0;
          } else if (itemDate >= p2Start && itemDate <= p2End) {
            c2Created += item.created || 0;
            c2Completed += item.completed || 0;
          }
        }

        points.push({
          date: p1Start,
          label: `01-15/${mm}`,
          created: c1Created,
          completed: c1Completed,
        });

        points.push({
          date: p2Start,
          label: `16-${lastDay}/${mm}`,
          created: c2Created,
          completed: c2Completed,
        });
      }
      return points;
    }

    return data as TaskTrendChartPoint[];
  }, [data, range]);

  const hasCreated = chartData.some((d) => typeof d.created === 'number');

  // Kiểm tra 0 data hoặc mảng rỗng
  const isEmpty = chartData.length === 0 || chartData.every((d) => (d.created || 0) === 0 && (d.completed || 0) === 0);

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
      <div className="relative w-full" aria-label={t('dashboard:taskTrendChart.chartAriaLabel')}>
        {isEmpty && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span className="text-[13px] text-text-tertiary bg-bg-surface/80 px-3 py-1.5 rounded">
              {t('dashboard:taskTrendChart.emptyOverlay')}
            </span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 24, left: 24, bottom: 0 }}>
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
              dataKey="label"
              interval="preserveStartEnd"
              minTickGap={16}
              padding={{ left: 12, right: 12 }}
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
              name={t('dashboard:taskTrendChart.completedLine')}
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
                name={t('dashboard:taskTrendChart.createdLine')}
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
            <span>{t('dashboard:taskTrendChart.completedLine')}</span>
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
              <span>{t('dashboard:taskTrendChart.createdLine')}</span>
            </div>
          )}
        </div>
      </div>
    </QueryState>
  );
});

