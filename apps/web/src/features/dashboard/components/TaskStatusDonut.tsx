import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { TASK_STATUS_COLOR } from '@/lib/chart-colors';
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

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="flex items-center gap-1.5 text-slate-600">
        <span className="h-2 w-2 rounded-full" style={{ background: p.payload.fill }} />
        {p.name}: <span className="font-semibold text-slate-900">{p.value}</span>
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
  const total = data.reduce((sum, d) => sum + (d.count || 0), 0);
  const chartData = data.map((d) => ({ ...d, fill: TASK_STATUS_COLOR[d.status] ?? '#94a3b8' }));

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
      errorTitle="Không thể tải trạng thái công việc"
      errorDescription="Đã xảy ra lỗi khi tải dữ liệu biểu đồ. Vui lòng thử lại."
    >
      {total === 0 ? (
        <EmptyState title="Chưa có công việc nào" description="Biểu đồ trạng thái sẽ hiển thị khi có công việc trong hệ thống." />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-56 w-56 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="count" nameKey="status" innerRadius={62} outerRadius={92} paddingAngle={2} strokeWidth={2} stroke="#fff">
                  {chartData.map((d) => (
                    <Cell key={d.status} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums text-slate-900">{total}</span>
              <span className="text-xs text-slate-400">công việc</span>
            </div>
          </div>
          <ul className="w-full space-y-2">
            {chartData.map((d) => (
              <li key={d.status} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
                  {statusLabel(d.status)}
                </span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {d.count}
                  <span className="ml-1 font-normal text-slate-400">({total ? Math.round((d.count / total) * 100) : 0}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </QueryState>
  );
}
