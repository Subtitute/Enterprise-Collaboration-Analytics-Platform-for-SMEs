import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORICAL, CHART_INK } from '@/lib/chart-colors';
import { formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DocumentActivityPoint } from '@/types';

function ActivityTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
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

export function DocumentActivityChart({ data }: { data: DocumentActivityPoint[] }) {
  const hasShares = data.some((d) => typeof d.shares === 'number');

  if (data.length === 0) {
    return <EmptyState title="Chưa có dữ liệu hoạt động tài liệu" />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="doc-activity-uploads" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CATEGORICAL[0]} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CATEGORICAL[0]} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="doc-activity-shares" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CATEGORICAL[4]} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CATEGORICAL[4]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => formatDate(v)}
          tick={{ fill: CHART_INK.muted, fontSize: 12 }}
          axisLine={{ stroke: CHART_INK.baseline }}
          tickLine={false}
        />
        <YAxis allowDecimals={false} tick={{ fill: CHART_INK.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<ActivityTooltip />} />
        {hasShares && <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} iconType="circle" iconSize={8} />}
        <Area
          type="monotone"
          dataKey="uploads"
          name="Tải lên"
          stroke={CATEGORICAL[0]}
          strokeWidth={2}
          fill="url(#doc-activity-uploads)"
        />
        {hasShares && (
          <Area
            type="monotone"
            dataKey="shares"
            name="Chia sẻ"
            stroke={CATEGORICAL[4]}
            strokeWidth={2}
            fill="url(#doc-activity-shares)"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
