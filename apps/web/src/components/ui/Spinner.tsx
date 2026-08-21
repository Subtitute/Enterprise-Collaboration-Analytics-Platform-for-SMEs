import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const { t } = useTranslation();
  return (
    <span
      role="status"
      aria-label={t('common:loading')}
      className={cn(
        'inline-block animate-spin rounded-full border-current border-t-transparent text-primary-600',
        sizeClasses[size],
        className,
      )}
    />
  );
}

export function FullPageSpinner({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-[40vh] w-full flex-col items-center justify-center gap-3 text-slate-400">
      <Spinner size="lg" />
      <p className="text-sm">{label ?? t('common:loading')}</p>
    </div>
  );
}
