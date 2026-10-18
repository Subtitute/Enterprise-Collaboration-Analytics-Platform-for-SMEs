// 16/10/2026: Bieu do "Xu huong ban hang theo san pham" (Danh muc san pham + Kho, Technical_Spec.md
// muc 22) - mirror cau truc DocumentActivityChart.tsx trong chinh thu muc nay (AreaChart +
// CHART_INK + QueryState/EmptyState dung chung), chi doi du lieu nguon sang ProductSalesTrendPoint.
// Chi ve 1 duong Doanh thu (cung thang do voi "Doanh so/Deal thang" o the KPI) de tranh 2 truc cho
// 2 don vi lech nhau (VND vs so luong) - Số lượng bán van hien day du trong tooltip, doc truc tiep
// tu payload[0].payload (du lieu goc ca diem, khong chi dataKey dang ve) nhu ProjectProgressChart.tsx
// da lam voi ProgressTooltip.
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { CHART_INK } from '@/lib/chart-colors';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import { formatDealValue } from '@/features/crm/utils';
import type { ProductSalesTrendPoint } from '@/types';

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: ProductSalesTrendPoint }>; label?: string }) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-radius-md border border-border-subtle bg-surface px-3 py-2 text-xs shadow-none">
      <p className="mb-1 font-mono font-medium text-text-primary tabular-nums">{formatDate(label)}</p>
      <p className="text-text-secondary">
        {t('analytics:productSales.trendChart.revenueLabel')}:{' '}
        <span className="font-mono font-medium text-text-primary tabular-nums">{formatDealValue(row.revenue)}</span>
      </p>
      <p className="text-text-secondary">
        {t('analytics:productSales.trendChart.unitsSoldLabel')}:{' '}
        <span className="font-mono font-medium text-text-primary tabular-nums">{row.unitsSold}</span>
      </p>
    </div>
  );
}

interface ProductSalesTrendChartProps {
  data: ProductSalesTrendPoint[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function ProductSalesTrendChart({ data, isLoading, isError, onRetry }: ProductSalesTrendChartProps) {
  const { t } = useTranslation();

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
      errorTitle={t('analytics:productSales.trendChart.errorTitle')}
      errorDescription={t('analytics:productSales.trendChart.errorDescription')}
    >
      {data.length === 0 ? (
        <EmptyState title={t('analytics:productSales.trendChart.emptyTitle')} />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
            <defs>
              <linearGradient id="product-sales-revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0E5E5E" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#0E5E5E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_INK.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatDate(v)}
              tick={{ fill: CHART_INK.muted, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
              axisLine={{ stroke: CHART_INK.baseline }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tickFormatter={(v) => new Intl.NumberFormat('vi-VN').format(Number(v))}
              tick={{ fill: CHART_INK.muted, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={<TrendTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              name={t('analytics:productSales.trendChart.revenueLabel')}
              stroke="#0E5E5E"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#product-sales-revenue)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 1.5, fill: '#0E5E5E', stroke: '#ffffff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </QueryState>
  );
}
