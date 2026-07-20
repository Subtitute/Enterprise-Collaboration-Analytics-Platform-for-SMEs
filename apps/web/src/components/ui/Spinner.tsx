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
  return (
    <span
      role="status"
      aria-label="Đang tải"
      className={cn(
        'inline-block animate-spin rounded-full border-current border-t-transparent text-primary-600',
        sizeClasses[size],
        className,
      )}
    />
  );
}

export function FullPageSpinner({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[40vh] w-full flex-col items-center justify-center gap-3 text-slate-400">
      <Spinner size="lg" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
