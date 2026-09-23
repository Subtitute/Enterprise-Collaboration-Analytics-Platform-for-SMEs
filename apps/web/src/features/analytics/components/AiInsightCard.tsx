import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { AlertCircleIcon, TrendingUpIcon, InfoIcon } from '@/components/ui/Icons';
import type { StructuredInsight } from '@/types';

interface AiInsightCardProps {
  insight: StructuredInsight;
  scopeLabel: string;
  index: number;
}

const SEVERITY_STYLE: Record<StructuredInsight['severity'], { border: string; bg: string; icon: typeof AlertCircleIcon; iconColor: string }> = {
  critical: { border: 'border-rose-200', bg: 'bg-rose-50/60', icon: AlertCircleIcon, iconColor: 'text-rose-600' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50/60', icon: AlertCircleIcon, iconColor: 'text-amber-600' },
  info: { border: 'border-emerald-200', bg: 'bg-emerald-50/60', icon: TrendingUpIcon, iconColor: 'text-emerald-600' },
};

/**
 * 22/09/2026: 1 card cho 1 StructuredInsight - thay the khoi van ban tu do (AI viet, frontend
 * regex-tach thanh 3 gach dau dong) o ban thiet ke cu. `animate-slide-up` (tailwind.config.ts, co
 * san - dung chung voi Toast.tsx) + `animationDelay` theo `index` tao hieu ung "lan luot xuat
 * hien" khi danh sach insight moi duoc tra ve, thay vi bung ra ca khoi cung luc.
 */
export function AiInsightCard({ insight, scopeLabel, index }: AiInsightCardProps) {
  const { t } = useTranslation();
  const style = SEVERITY_STYLE[insight.severity];
  const Icon = style.icon;
  const isBetterThanOrg = insight.evidence.comparisonValue !== null && insight.evidence.value >= insight.evidence.comparisonValue;

  return (
    <div
      className={cn('animate-slide-up rounded-xl border p-4 shadow-2xs', style.border, style.bg)}
      style={{ animationDelay: `${index * 90}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn('h-4 w-4 shrink-0', style.iconColor)} />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 truncate">{scopeLabel}</span>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', style.iconColor, style.bg)}>
          {t(`analytics:aiInsight.severity.${insight.severity}`)}
        </span>
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-900">{insight.headline}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{insight.detail}</p>

      {insight.evidence.comparisonValue !== null && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs">
          <span className={cn('font-bold', isBetterThanOrg ? 'text-emerald-600' : 'text-rose-600')}>
            {insight.evidence.value}%
          </span>
          <span className="text-slate-400">
            {t('analytics:aiInsight.comparisonLabel', { value: insight.evidence.comparisonValue })}
          </span>
        </div>
      )}

      {insight.recommendation && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-white/70 p-2 text-xs text-indigo-800">
          <InfoIcon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-indigo-500" />
          <span>{insight.recommendation}</span>
        </div>
      )}
    </div>
  );
}
