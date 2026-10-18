// 16/10/2026: Bieu do xep hang "San pham ban chay nhat" (Danh muc san pham + Kho,
// Technical_Spec.md muc 22) - mirror cau truc ProjectProgressChart.tsx (BarChart ngang) trong
// chinh thu muc nay. Du lieu nguon (TopProduct[]) chi co productId/categoryId tho - AnalyticsPage.tsx
// tu resolve `name` qua GET /products truoc khi truyen vao day (xem resolveInsightScopeLabel/
// projectNames o AnalyticsPage.tsx, cung 1 kieu join phia client).
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { CHART_INK } from '@/lib/chart-colors';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import { formatDealValue } from '@/features/crm/utils';

export interface TopProductRow {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

function TopProductsTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TopProductRow }> }) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-radius-md border border-border-subtle bg-surface px-3 py-2 text-xs shadow-none">
      <p className="font-medium text-text-primary">{row.name}</p>
      <p className="text-text-secondary">
        {t('analytics:productSales.topProductsChart.tooltipUnitsSoldLabel')}{' '}
        <span className="font-mono font-medium text-text-primary tabular-nums">{row.unitsSold}</span>
      </p>
      <p className="text-text-secondary">
        {t('analytics:productSales.topProductsChart.tooltipRevenueLabel')}{' '}
        <span className="font-mono font-medium text-text-primary tabular-nums">{formatDealValue(row.revenue)}</span>
      </p>
    </div>
  );
}

interface TopProductsChartProps {
  data: TopProductRow[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function TopProductsChart({ data, isLoading, isError, onRetry }: TopProductsChartProps) {
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
      errorTitle={t('analytics:productSales.topProductsChart.errorTitle')}
      errorDescription={t('analytics:productSales.topProductsChart.errorDescription')}
    >
      {data.length === 0 ? (
        <EmptyState title={t('analytics:productSales.topProductsChart.emptyTitle')} />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap={10}>
            <CartesianGrid stroke={CHART_INK.grid} horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
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
            <Tooltip content={<TopProductsTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Bar dataKey="unitsSold" fill="#0E5E5E" radius={[0, 4, 4, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </QueryState>
  );
}
