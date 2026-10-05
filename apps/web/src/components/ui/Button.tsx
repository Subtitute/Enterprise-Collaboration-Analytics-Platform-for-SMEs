import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1C1B1A] text-[#F7F6F3] hover:bg-[#2E2C29] active:bg-[#141312] border border-transparent shadow-none focus-visible:ring-accent focus-visible:border-accent',
  secondary:
    'bg-white text-text-primary hover:bg-bg-subtle active:bg-bg-muted border border-border-strong shadow-none focus-visible:ring-accent focus-visible:border-accent',
  outline:
    'bg-white text-text-primary hover:bg-bg-subtle border border-border-strong shadow-none focus-visible:ring-accent focus-visible:border-accent',
  ghost:
    'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-subtle active:bg-bg-muted border border-transparent shadow-none focus-visible:ring-accent',
  danger:
    'bg-error text-white hover:bg-[#962019] active:bg-[#7D1B15] border border-transparent shadow-none focus-visible:ring-error',
  link:
    'bg-transparent text-accent hover:text-accent-hover hover:underline p-0 h-auto border-none shadow-none active:text-accent-hover focus-visible:ring-accent',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[13px] leading-5 font-medium gap-1.5',
  md: 'h-9 px-3.5 text-sm leading-[22px] font-medium gap-1.5',
  lg: 'h-11 px-4.5 text-sm leading-[22px] font-medium gap-2',
  icon: 'h-9 w-9 p-0 justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center rounded-radius-md font-medium transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-accent-soft',
          'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
          variantClasses[variant],
          variant !== 'link' && sizeClasses[size],
          className,
        )}
        {...props}
      >
        {isLoading && (
          <Spinner
            size="sm"
            className={cn('mr-1.5 h-3.5 w-3.5', variant === 'primary' || variant === 'danger' ? 'text-[#F7F6F3]' : 'text-text-secondary')}
          />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
