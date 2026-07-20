import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, className, trackClassName, barClassName, showLabel }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('h-2 w-full flex-1 overflow-hidden rounded-full bg-slate-100', trackClassName)}>
        <div
          className={cn('h-full rounded-full bg-primary-500 transition-all', barClassName)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && <span className="w-9 shrink-0 text-right text-xs font-medium text-slate-500">{clamped}%</span>}
    </div>
  );
}
