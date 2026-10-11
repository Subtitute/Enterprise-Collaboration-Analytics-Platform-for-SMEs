import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { BarChartIcon } from '@/components/ui/Icons';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import type { AiInsightsResult, DrillDownScope, InsightScope } from '@/types';
import { AiInsightsChart } from './AiInsightsChart';
import { AiInsightCard } from './AiInsightCard';

export interface AiAssistantSectionProps {
  aiPeriod: 'week' | 'month' | 'quarter' | 'year';
  onPeriodChange: (period: 'week' | 'month' | 'quarter' | 'year') => void;
  onGenerate: () => void;
  isPending: boolean;
  data: AiInsightsResult | undefined;
  resolveLabel: (scope: InsightScope, scopeId: string | null) => string;
  onDrillDown: (scope: DrillDownScope, scopeId: string) => void;
}

export const AiAssistantSection = React.memo(function AiAssistantSection({
  aiPeriod,
  onPeriodChange,
  onGenerate,
  isPending,
  data,
  resolveLabel,
  onDrillDown,
}: AiAssistantSectionProps) {
  const { t } = useTranslation();

  return (
    /* KHỐI TRỢ LÝ PHÂN TÍCH NỘI BỘ (SPEC V1.1 - DATA-FIRST, ZERO-SHADOW, ZERO-ACCENT-MISMATCH) */
    <div className="bg-surface rounded-radius-md border border-border-subtle hover:border-border-strong p-5 shadow-none transition-colors">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-radius-md bg-accent-soft text-accent">
            <BarChartIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] leading-[22px] font-semibold text-text-primary">{t('analytics:aiInsight.title')}</h3>
              <span className="inline-flex items-center h-[22px] rounded-[2px] bg-info-soft px-2 text-[11px] font-semibold text-info">
                {t('analytics:aiInsight.badge')}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] leading-[20px] text-text-secondary">
              {t('analytics:aiInsight.summaryAllOrg', { period: t(`analytics:aiInsight.periods.${aiPeriod}`).toLowerCase() })}
            </p>
          </div>
        </div>

        {/* ROW DƯỚI CÙNG HÀNG: Select kỳ (width 220) bên trái + nút Primary ink bên phải */}
        <div className="flex items-center justify-between w-full gap-3 pt-1">
          <div className="w-[220px] max-w-[220px] shrink-0">
            <CustomFilterSelect
              value={aiPeriod}
              onChange={(val) => onPeriodChange(val as 'week' | 'month' | 'quarter' | 'year')}
              ariaLabel={t('analytics:aiInsight.periodAriaLabel')}
              options={[
                { value: 'week', label: t('analytics:aiInsight.periods.week') },
                { value: 'month', label: t('analytics:aiInsight.periods.month') },
                { value: 'quarter', label: t('analytics:aiInsight.periods.quarter') },
                { value: 'year', label: t('analytics:aiInsight.periods.year') },
              ]}
              className="w-full"
            />
          </div>

          <Button
            size="sm"
            isLoading={isPending}
            onClick={onGenerate}
            className="bg-text-primary text-white hover:bg-slate-800 shadow-none cursor-pointer shrink-0 h-9 px-4"
          >
            <BarChartIcon className="h-4 w-4" />
            {t('analytics:aiInsight.generateButton')}
          </Button>
        </div>
      </div>

      <div className="mt-4 pt-3.5 border-t border-border-subtle">
        {data ? (
          <div className="space-y-4">
            <div className="rounded-radius-md bg-canvas p-4 border border-border-subtle">
              <AiInsightsChart
                candidates={data.candidates}
                insights={data.insights}
                resolveLabel={resolveLabel}
                onDrillDown={onDrillDown}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.insights.map((insight, index) => (
                <AiInsightCard
                  key={`${insight.scope}-${insight.scopeId ?? 'org'}-${index}`}
                  insight={insight}
                  index={index}
                  scopeLabel={resolveLabel(insight.scope, insight.scopeId)}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-secondary leading-relaxed">
            {t('analytics:aiInsight.placeholder')}
          </p>
        )}
      </div>
    </div>
  );
});

