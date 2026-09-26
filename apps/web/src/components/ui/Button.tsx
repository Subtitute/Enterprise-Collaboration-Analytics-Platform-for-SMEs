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
    'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs ring-1 ring-inset ring-white/10 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
  secondary:
    'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200/80 shadow-xs active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1',
  outline:
    'border border-slate-300/80 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-xs active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 shadow-xs ring-1 ring-inset ring-white/10 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5 font-medium',
  md: 'h-9 px-3.5 text-sm gap-2 font-medium',
  lg: 'h-10 px-4 text-sm gap-2 font-medium',
  icon: 'h-8 w-8 p-0 justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-all duration-150',
          'focus-visible:outline-none',
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
