import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORICAL, CHART_INK } from '@/lib/chart-colors';
import { EmptyState } from '@/components/ui/EmptyState';

export interface ProjectProgressRow {
  projectId: string;
  name: string;
  progress: number;
}

function ProgressTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ProjectProgressRow }> }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-slate-700">{row.name}</p>
      <p className="text-slate-600">
        Tiến độ: <span className="font-semibold text-slate-900">{row.progress}%</span>
      </p>
    </div>
  );
}

export function ProjectProgressChart({ data }: { data: ProjectProgressRow[] }) {
  if (data.length === 0) {
    return <EmptyState title="Chưa có dữ liệu tiến độ dự án" />;
  }

  const height = Math.max(220, data.length * 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap={10}>
        <CartesianGrid stroke={CHART_INK.grid} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: CHART_INK.muted, fontSize: 12 }}
          axisLine={{ stroke: CHART_INK.baseline }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ fill: CHART_INK.secondary, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ProgressTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Bar dataKey="progress" fill={CATEGORICAL[0]} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
