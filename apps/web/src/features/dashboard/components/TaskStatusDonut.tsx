import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import { TASK_STATUS_COLOR } from '@/lib/chart-colors';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import type { TaskStatusBreakdownItem } from '@/types';
// 20/08/2026: `statusLabel` la ham NGOAI component (module-level) - khong the goi
// useTranslation() (vi pham Rules of Hooks). Dung tham chieu `t` khong-qua-hook tu i18n/index.ts.
// Van tu dong doi ngon ngu dung vi component cha (DashboardPage) da dung useTranslation() nen
// re-render moi khi doi ngon ngu, keo theo TaskStatusDonut re-render lai theo.
import { t } from '@/i18n';

function statusLabel(status: string) {
  return t(`projects:enums.taskStatus.${status}`, { defaultValue: status });
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string; status: string } }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 text-xs shadow-xl shadow-slate-200/60 backdrop-blur-md">
      <p className="flex items-center gap-1.5 text-slate-700 font-medium">
        <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ background: p.payload.fill }} />
        {statusLabel(p.payload.status)}: <span className="font-bold text-slate-900">{p.value}</span>
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

export function TaskStatusDonut({ data, isLoading, isError, onRetry }: TaskStatusDonutProps) {
  const { t } = useTranslation();
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  const total = data.reduce((sum, d) => sum + (d.count || 0), 0);
  const chartData = data.map((d) => ({ ...d, fill: TASK_STATUS_COLOR[d.status] ?? '#94a3b8' }));

  const activeItem = hoveredStatus ? chartData.find((d) => d.status === hoveredStatus) : null;

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
      errorTitle={t('dashboard:taskStatusDonut.errorTitle')}
      errorDescription={t('dashboard:taskStatusDonut.errorDescription')}
    >
      {total === 0 ? (
        <EmptyState title={t('dashboard:taskStatusDonut.emptyTitle')} description={t('dashboard:taskStatusDonut.emptyDescription')} />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-56 w-56 shrink-0">
            {/* Tương tác tâm (Center Text) nằm ở tầng nền z-0 với pointer-events-none tuyệt đối để chuột xuyên qua */}
            <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center text-center px-4 transition-all duration-200 select-none">
              {activeItem ? (
                <div className="animate-fade-in flex flex-col items-center">
                  <span className="text-2xl font-bold tracking-tight tabular-nums text-slate-900">
                    {activeItem.count}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[110px]">
                    {statusLabel(activeItem.status)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {/* 26/08/2026: chuyen sang t() voi interpolation {{percent}} thay vi ghep chuoi
                        JSX truc tiep - fix check-hardcoded-vietnamese.js, dong thoi cho phep ban
                        dich tieng Nhat doi lai vi tri "全体の{{percent}}%" (dat truoc %) thay vi
                        bi ep giu nguyen thu tu tieng Viet "{{percent}}% tổng số". */}
                    {t('dashboard:taskStatusDonut.percentOfTotal', {
                      percent: total ? Math.round((activeItem.count / total) * 100) : 0,
                    })}
                  </span>
                </div>
              ) : (
                <div className="animate-fade-in flex flex-col items-center">
                  <span className="text-2xl font-bold tracking-tight tabular-nums text-slate-900">{total}</span>
                  <span className="text-xs text-slate-500 font-medium">{t('dashboard:taskStatusDonut.unit')}</span>
                </div>
              )}
            </div>

            {/* Lớp vẽ biểu đồ Donut nằm ở tầng z-10 */}
            <div className="relative z-10 h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={68}
                    outerRadius={96}
                    paddingAngle={3}
                    cornerRadius={6}
                    strokeWidth={0}
                    onMouseEnter={(_, index) => {
                      if (chartData[index]) setHoveredStatus(chartData[index].status);
                    }}
                    onMouseLeave={() => setHoveredStatus(null)}
                  >
                    {chartData.map((d) => (
                      <Cell
                        key={d.status}
                        fill={d.fill}
                        className="transition-all duration-200 cursor-pointer"
                        opacity={hoveredStatus === null || hoveredStatus === d.status ? 1 : 0.45}
                        style={{ outline: 'none' }}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <ul className="w-full space-y-2">
            {chartData.map((d) => {
              const isHovered = hoveredStatus === d.status;
              return (
                <li
                  key={d.status}
                  onMouseEnter={() => setHoveredStatus(d.status)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  className={cn(
                    'flex items-center justify-between gap-2 text-sm rounded-lg px-2 py-1.5 transition-all duration-150 cursor-pointer',
                    isHovered ? 'bg-slate-100/90 font-medium shadow-sm' : 'hover:bg-slate-50',
                  )}
                >
                  <span className="flex items-center gap-2 text-slate-700">
                    <span
                      className="h-2.5 w-2.5 rounded-full shadow-sm transition-transform duration-150"
                      style={{
                        background: d.fill,
                        transform: isHovered ? 'scale(1.25)' : 'scale(1)',
                      }}
                    />
                    <span className={cn(isHovered && 'text-slate-900 font-semibold')}>{statusLabel(d.status)}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {d.count}
                    <span className="ml-1 font-normal text-slate-400">({total ? Math.round((d.count / total) * 100) : 0}%)</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </QueryState>
  );
}
