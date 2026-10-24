import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { TrendingUpIcon } from '@/components/ui/Icons';
import { formatDealValue } from '@/features/crm/utils';

export interface KpiStatsData {
  totalProjects: number;
  avgProgress: number;
  totalDocVolume: number;
  wonDealsCount: number;
  totalWonValue: number;
  trend: {
    proj: string;
    prog: string;
    doc: string;
    deal: string;
  };
}

export interface AnalyticsKpiCardsProps {
  stats: KpiStatsData;
}

export const AnalyticsKpiCards = React.memo(function AnalyticsKpiCards({ stats }: AnalyticsKpiCardsProps) {
  const { t } = useTranslation();

  return (
    /* HÀNG 4 THẺ CHỈ SỐ KPI NHANH (STAT CARDS - DATA FIRST, ZERO-SHADOW, ZERO-ICON) */
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* KPI 1: Tổng dự án đang chạy */}
      <Card className="p-5 bg-surface border border-border-subtle hover:border-border-strong rounded-radius-md transition-colors shadow-none">
        <div>
          <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
            {t('analytics:kpiCards.activeProjects')}
          </span>
        </div>
        <div className="mt-2">
          <span className="font-mono text-[40px] leading-[48px] font-medium text-text-primary tabular-nums">
            {stats.totalProjects}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 font-mono text-xs font-medium text-success tabular-nums">
          <TrendingUpIcon className="h-3 w-3 shrink-0" />
          <span>{stats.trend.proj}</span>
        </div>
      </Card>

      {/* KPI 2: Tỷ lệ tiến độ trung bình */}
      <Card className="p-5 bg-surface border border-border-subtle hover:border-border-strong rounded-radius-md transition-colors shadow-none">
        <div>
          <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
            {t('analytics:kpiCards.avgProgress')}
          </span>
        </div>
        <div className="mt-2">
          <span className="font-mono text-[40px] leading-[48px] font-medium text-text-primary tabular-nums">
            {stats.avgProgress}%
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 font-mono text-xs font-medium text-success tabular-nums">
          <TrendingUpIcon className="h-3 w-3 shrink-0" />
          <span>{stats.trend.prog}</span>
        </div>
      </Card>

      {/* KPI 3: Khối lượng tài liệu mới */}
      <Card className="p-5 bg-surface border border-border-subtle hover:border-border-strong rounded-radius-md transition-colors shadow-none">
        <div>
          <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
            {t('analytics:kpiCards.newDocuments')}
          </span>
        </div>
        <div className="mt-2">
          <span className="font-mono text-[40px] leading-[48px] font-medium text-text-primary tabular-nums">
            {stats.totalDocVolume}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 font-mono text-xs font-medium text-success tabular-nums">
          <TrendingUpIcon className="h-3 w-3 shrink-0" />
          <span>{stats.trend.doc}</span>
        </div>
      </Card>

      {/* KPI 4: Doanh số / Deal hoàn tất - Teal #0E5E5E */}
      <Card className="p-5 bg-surface border border-border-subtle hover:border-border-strong rounded-radius-md transition-colors shadow-none">
        <div>
          <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
            {t('analytics:kpiCards.completedDeals')}
          </span>
        </div>
        <div className="mt-2">
          <span
            className="font-mono text-2xl sm:text-3xl xl:text-[28px] 2xl:text-[34px] leading-tight font-medium text-accent whitespace-nowrap block tabular-nums"
            title={formatDealValue(stats.totalWonValue)}
          >
            {stats.totalWonValue > 0 ? formatDealValue(stats.totalWonValue) : `${stats.wonDealsCount} deal`}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 font-mono text-xs font-medium text-success tabular-nums">
          <TrendingUpIcon className="h-3 w-3 shrink-0" />
          <span>{stats.trend.deal}</span>
        </div>
      </Card>
    </div>
  );
});

