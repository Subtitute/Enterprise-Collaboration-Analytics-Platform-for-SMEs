import { useState, memo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import type { TaskStatusBreakdownItem } from '@/types';

// Bảng màu chuẩn theo §7 Spec:
// To Do: #8A8781, In Progress: #1E5A8A, Done: #2F6F44
const STATUS_COLORS: Record<string, string> = {
  TODO: '#8A8781',
  DOING: '#1E5A8A',
  IN_PROGRESS: '#1E5A8A',
  DONE: '#2F6F44',
};

function getStatusLabel(status: string, translate: (key: string, def?: any) => string) {
  const normalized = status === 'IN_PROGRESS' ? 'DOING' : status;
  if (normalized === 'TODO') return translate('dashboard:status.toDo', 'Cần làm');
  if (normalized === 'DOING') return translate('dashboard:status.inProgress', 'Đang làm');
  if (normalized === 'DONE') return translate('dashboard:status.done', 'Hoàn thành');
  return translate(`projects:enums.taskStatus.${normalized}`, { defaultValue: status });
}

function DonutTooltip({ active, payload, translate }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string; status: string } }>; translate: (key: string, def?: any) => string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-radius-sm bg-[#1C1B1A] text-[#F7F6F3] px-2.5 py-2 text-[12px] font-medium shadow-sm">
      <p className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.payload.fill }} />
        <span>{getStatusLabel(p.payload.status, translate)}:</span>
        <span className="font-mono font-semibold text-white">{p.value}</span>
      </p>
    </div>
  );
}

interface TaskStatusDonutProps {
  data: TaskStatusBreakdownItem[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export const TaskStatusDonut = memo(function TaskStatusDonut({ data, isLoading, isError, onRetry }: TaskStatusDonutProps) {
  const { t: translate } = useTranslation();
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  // 3 trạng thái nguyên bản: Cần làm (TODO), Đang làm (DOING), Hoàn thành (DONE)
  const order = ['TODO', 'DOING', 'DONE'];
  const dataMap = new Map<string, number>();
  for (const d of data) {
    const k = d.status === 'IN_PROGRESS' ? 'DOING' : d.status;
    dataMap.set(k, (dataMap.get(k) || 0) + (d.count || 0));
  }

  const items = order.map((status) => ({
    status,
    count: dataMap.get(status) || 0,
    fill: STATUS_COLORS[status] || '#8A8781',
  }));

  const total = items.reduce((sum, d) => sum + d.count, 0);

  // Empty state theo §11: Donut ring rỗng màu bg-muted #E7E5DF, center `0 công việc`, legend tất cả 0
  const isEmpty = total === 0;
  // Lọc chỉ các trạng thái có count > 0 đưa vào biểu đồ để tránh lát cắt 0 giá trị làm mất khoảng hở paddingAngle
  const activeSlices = items.filter((d) => d.count > 0);
  const chartData = isEmpty
    ? [{ status: 'EMPTY', count: 1, fill: '#E7E5DF' }]
    : activeSlices;

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      loadingFallback={
        <div className="flex h-56 items-center justify-center">
          <Spinner />
        </div>
      }
      errorTitle={translate('dashboard:taskStatusDonut.errorTitle')}
      errorDescription={translate('dashboard:taskStatusDonut.errorDescription')}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 w-full min-w-0" aria-label="Biểu đồ phân bổ trạng thái công việc">
        {/* Ring mỏng: innerRadius 65, outerRadius 85 */}
        <div className="relative h-[180px] w-[180px] shrink-0 mx-auto">
          {/* Tâm tròn: số tổng font IBM Plex Mono 32/40 + label 12/400 */}
          <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center text-center px-1 select-none">
            <span className="font-mono text-[32px] leading-[40px] font-medium tracking-tight tabular-nums text-text-primary">
              {total}
            </span>
            <span className="text-[12px] leading-[16px] text-text-tertiary">
              {translate('dashboard:taskStatusDonut.unit', 'công việc')}
            </span>
          </div>

          <div className="relative z-10 h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={isEmpty || chartData.length <= 1 ? 0 : 3}
                  strokeWidth={isEmpty ? 0 : 2}
                  stroke="#FFFFFF"
                  onMouseEnter={(_, index) => {
                    if (!isEmpty && chartData[index]) setHoveredStatus(chartData[index].status);
                  }}
                  onMouseLeave={() => setHoveredStatus(null)}
                >
                  {chartData.map((d) => (
                    <Cell
                      key={d.status}
                      fill={d.fill}
                      className={cn('transition-all duration-150', !isEmpty && 'cursor-pointer')}
                      opacity={isEmpty || hoveredStatus === null || hoveredStatus === d.status ? 1 : 0.4}
                      style={{ outline: 'none' }}
                    />
                  ))}
                </Pie>
                {!isEmpty && <Tooltip content={<DonutTooltip translate={translate} />} />}
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Legend FLAT LIST (§7): Không background, không border, không padding. Cách nhau 10px dọc */}
        <div className="w-full min-w-0 flex-1 space-y-2.5">
          {items.map((d) => {
            const isHovered = hoveredStatus === d.status;
            const percent = total > 0 ? Math.round((d.count / total) * 100) : 0;

            return (
              <div
                key={d.status}
                onMouseEnter={() => setHoveredStatus(d.status)}
                onMouseLeave={() => setHoveredStatus(null)}
                className={cn(
                  'flex items-center justify-between text-[13px] leading-[20px] cursor-pointer transition-colors select-none',
                  isHovered ? 'text-text-primary' : 'text-text-secondary'
                )}
              >
                {/* Chấm 8px + Label text-primary */}
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: d.fill }}
                  />
                  <span className={cn('truncate', isHovered ? 'font-medium text-text-primary' : 'text-text-primary')}>
                    {getStatusLabel(d.status, translate)}
                  </span>
                </div>

                {/* Số count font mono 13/500 text-primary căn phải + % font mono 12/400 text-tertiary width 44px */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[13px] font-medium text-text-primary text-right min-w-[24px]">
                    {d.count}
                  </span>
                  <span className="font-mono text-[12px] text-text-tertiary w-[44px] text-right">
                    {percent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </QueryState>
  );
});

