import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 hover:-translate-y-0.5 shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300/60 active:scale-95 active:translate-y-0 focus-visible:ring-indigo-500',
  secondary:
    'bg-slate-100 text-slate-900 hover:bg-slate-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/50 active:scale-95 active:translate-y-0 focus-visible:ring-indigo-500',
  outline:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/60 active:scale-95 active:translate-y-0 focus-visible:ring-indigo-500',
  ghost: 'text-slate-600 hover:bg-slate-100 active:scale-95 active:translate-y-0 focus-visible:ring-indigo-500',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose-500/30 active:scale-95 active:translate-y-0 focus-visible:ring-rose-500 shadow-sm',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
  icon: 'h-9 w-9 p-0 justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50 disabled:transform-none disabled:shadow-none',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {isLoading && <Spinner size="sm" className={variant === 'primary' || variant === 'danger' ? 'text-white' : undefined} />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
