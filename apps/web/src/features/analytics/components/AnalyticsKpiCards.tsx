// 29/10/2026 - Xóa bỏ badge phần trăm so với kỳ trước viết cứng, chỉ hiển thị số liệu thực tế trên thẻ KPI
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { formatDealValue } from '@/features/crm/utils';

export interface KpiStatsData {
  totalProjects: number;
  avgProgress: number;
  totalDocVolume: number;
  wonDealsCount: number;
  totalWonValue: number;
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
      </Card>
    </div>
  );
});
