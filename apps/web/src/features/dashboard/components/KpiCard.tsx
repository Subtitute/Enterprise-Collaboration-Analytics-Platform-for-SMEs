import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircleIcon, RefreshIcon, ArrowUpIcon, ArrowDownIcon, MinusIcon, CheckIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

export interface DeltaInfo {
  type: 'increase' | 'decrease' | 'neutral' | 'empty-good';
  text: string;
}

interface KpiCardProps {
  overline: string;
  value: ReactNode;
  unit?: string;
  delta?: DeltaInfo;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  className?: string;
  ariaLabel?: string;
}

export function KpiCard({
  overline,
  value,
  unit,
  delta,
  isLoading,
  isError,
  onRetry,
  className,
  ariaLabel,
}: KpiCardProps) {
  const { t } = useTranslation();

  return (
    <div
      role="region"
      aria-label={ariaLabel || overline}
      className={cn(
        'flex flex-col justify-between p-5 rounded-lg border border-border-subtle bg-bg-surface',
        className
      )}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
          {overline}
        </p>

        {isError ? (
          <div className="mt-3 flex items-center gap-1.5">
            <AlertCircleIcon className="h-4 w-4 shrink-0 text-text-error" />
            <span className="text-xs text-text-error">{t('dashboard:kpiCard.errorLabel', 'Lỗi tải dữ liệu')}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                aria-label={t('dashboard:kpiCard.retryAriaLabel', { label: overline })}
                className="rounded p-0.5 text-text-tertiary hover:bg-bg-subtle hover:text-text-secondary"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : isLoading ? (
          <div className="mt-3 h-10 w-24 animate-pulse rounded bg-bg-subtle" />
        ) : (
          <div className="mt-3 flex items-baseline gap-1">
            <span className="font-mono text-[40px] leading-[48px] font-medium tracking-tight tabular-nums text-text-primary">
              {value}
            </span>
            {unit && (
              <span className="text-[20px] leading-[28px] font-medium text-text-secondary">
                {unit}
              </span>
            )}
          </div>
        )}
      </div>

      {!isError && delta && !isLoading && (
        <div className="mt-2 flex items-center gap-1 text-[12px] leading-[16px]">
          {delta.type === 'increase' && (
            <>
              <ArrowUpIcon className="h-3 w-3 shrink-0 text-text-success" />
              <span className="text-text-success font-medium">{delta.text}</span>
            </>
          )}
          {delta.type === 'decrease' && (
            <>
              <ArrowDownIcon className="h-3 w-3 shrink-0 text-text-error" />
              <span className="text-text-error font-medium">{delta.text}</span>
            </>
          )}
          {delta.type === 'empty-good' && (
            <>
              <CheckIcon className="h-3 w-3 shrink-0 text-text-success" />
              <span className="text-text-success font-medium">{delta.text}</span>
            </>
          )}
          {delta.type === 'neutral' && (
            <>
              <MinusIcon className="h-3 w-3 shrink-0 text-text-tertiary" />
              <span className="text-text-tertiary font-medium">{delta.text}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

