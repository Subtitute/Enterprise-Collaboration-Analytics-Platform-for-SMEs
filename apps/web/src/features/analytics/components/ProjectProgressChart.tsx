import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { CATEGORICAL, CHART_INK } from '@/lib/chart-colors';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';

export interface ProjectProgressRow {
  projectId: string;
  name: string;
  progress: number;
}

function ProgressTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ProjectProgressRow }> }) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-radius-md border border-border-subtle bg-surface px-3 py-2 text-xs shadow-none">
      <p className="font-medium text-text-primary">{row.name}</p>
      <p className="text-text-secondary">
        {t('analytics:projectProgressChart.tooltipProgressLabel')}{' '}
        <span className="font-mono font-medium text-text-primary tabular-nums">{row.progress}%</span>
      </p>
    </div>
  );
}

interface ProjectProgressChartProps {
  data: ProjectProgressRow[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function ProjectProgressChart({ data, isLoading, isError, onRetry }: ProjectProgressChartProps) {
  const { t } = useTranslation();
  const height = Math.max(220, data.length * 40);

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      loadingFallback={
        <div className="flex h-[220px] items-center justify-center">
          <Spinner />
        </div>
      }
      errorTitle={t('analytics:projectProgressChart.errorTitle')}
      errorDescription={t('analytics:projectProgressChart.errorDescription')}
    >
      {data.length === 0 ? (
        <EmptyState title={t('analytics:projectProgressChart.emptyTitle')} />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap={10}>
            <CartesianGrid stroke={CHART_INK.grid} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: CHART_INK.muted, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
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
            <Bar dataKey="progress" fill="#0E5E5E" radius={[0, 4, 4, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </QueryState>
  );
}
