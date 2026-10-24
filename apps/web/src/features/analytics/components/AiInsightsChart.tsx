import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { CHART_INK, STATUS } from '@/lib/chart-colors';
import type { AiInsightCandidateSummary, DrillDownScope, InsightScope, InsightSeverity, StructuredInsight } from '@/types';

/** 22/09/2026: mau "khong duoc AI chon" - KHONG lay tu STATUS (4 mau do danh rieng cho trang thai
 *  duoc gan co chu dich, khong dung lai cho "khong co gi dang chu y" - xem dataviz skill "Status
 *  colors are reserved"). Mot xam trung tinh doc lap, dong vai tro "nen/boi canh" cho cac cot
 *  STATUS noi bat len ben canh. */
const NEUTRAL_BAR_COLOR = '#cbd5e1';

function severityColor(severity: InsightSeverity | null): string {
  if (severity === 'critical') return STATUS.critical;
  if (severity === 'warning') return STATUS.warning;
  if (severity === 'info') return STATUS.good;
  return NEUTRAL_BAR_COLOR;
}

interface ChartRow {
  key: string;
  scope: InsightScope;
  scopeId: string | null;
  name: string;
  completionRate: number;
  severity: InsightSeverity | null;
  headline?: string;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartRow }> }) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="max-w-[240px] rounded-radius-md border border-border-subtle bg-surface px-3 py-2 text-xs shadow-none">
      <p className="font-medium text-text-primary">{row.name}</p>
      <p className="text-text-secondary">
        {t('analytics:aiInsight.chart.completionRateLabel')}{' '}
        <span className="font-mono font-medium text-text-primary tabular-nums">{row.completionRate}%</span>
      </p>
      {row.headline && <p className="mt-1 text-text-secondary leading-snug">{row.headline}</p>}
    </div>
  );
}

interface AiInsightsChartProps {
  candidates: AiInsightCandidateSummary[];
  insights: StructuredInsight[];
  resolveLabel: (scope: InsightScope, scopeId: string | null) => string;
  /** 24/09/2026: Layer 2 Diagnostic - tuy chon (khong truyen = giu nguyen hanh vi cu, khong the
   *  bam duoc). Chi goi cho thanh scope=department|project (scope='organization' khong co 1
   *  scopeId cu the de drill-down). */
  onDrillDown?: (scope: DrillDownScope, scopeId: string) => void;
}

/**
 * 22/09/2026: bieu do so sanh TOAN BO pham vi da quet (to chuc + tung phong ban + top du an) - thay
 * the/bo sung cho danh sach card thuan van ban. Chi ung vien duoc AI CHON lam insight (severity !=
 * null) moi to mau STATUS (do/cam/xanh - "reserved", khong dung cho series thong thuong), con lai
 * la xam trung tinh - giup nguoi xem THAY NGAY cac diem bat thuong noi bat len tren nen so sanh
 * day du, thay vi chi doc 1 con so rieng le.
 */
export const AiInsightsChart = React.memo(function AiInsightsChart({
  candidates,
  insights,
  resolveLabel,
  onDrillDown,
}: AiInsightsChartProps) {
  const { t } = useTranslation();

  const rows: ChartRow[] = useMemo(() => {
    return candidates
      .map((c) => {
        const matched = insights.find((i) => i.scope === c.scope && i.scopeId === c.scopeId);
        return {
          key: `${c.scope}-${c.scopeId ?? 'org'}`,
          scope: c.scope,
          scopeId: c.scopeId,
          name: resolveLabel(c.scope, c.scopeId),
          completionRate: c.completionRate,
          severity: matched?.severity ?? null,
          headline: matched?.headline,
        };
      })
      .sort((a, b) => a.completionRate - b.completionRate);
  }, [candidates, insights, resolveLabel]);

  const height = useMemo(() => Math.max(180, rows.length * 34), [rows.length]);

  if (rows.length === 0) return null;

  return (
    <div>
      {/* Chu giai - status mang y nghia TRANG THAI (duoc AI gan co chu dich), khong phai 1 series
          thong thuong nen luon di kem nhan chu (khong chi mau) - xem dataviz skill. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {(['critical', 'warning', 'info'] as const).map((severity) => (
          <span key={severity} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: severityColor(severity) }} />
            {t(`analytics:aiInsight.severity.${severity}`)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: NEUTRAL_BAR_COLOR }} />
          {t('analytics:aiInsight.chart.otherLabel')}
        </span>
      </div>

      {onDrillDown && <p className="mb-1.5 text-[11px] text-slate-400">{t('analytics:aiInsight.chart.drillDownHint')}</p>}

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 4 }} barCategoryGap={8}>
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
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Bar dataKey="completionRate" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {rows.map((row) => {
              const canDrillDown = row.scope !== 'organization' && Boolean(row.scopeId);
              const handleClick =
                onDrillDown && canDrillDown ? () => onDrillDown(row.scope as DrillDownScope, row.scopeId as string) : undefined;
              return (
                <Cell
                  key={row.key}
                  fill={severityColor(row.severity)}
                  cursor={handleClick ? 'pointer' : undefined}
                  onClick={handleClick}
                />
              );
            })}
            <LabelList
              dataKey="completionRate"
              position="right"
              formatter={(v: number) => `${v}%`}
              style={{ fill: CHART_INK.secondary, fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
