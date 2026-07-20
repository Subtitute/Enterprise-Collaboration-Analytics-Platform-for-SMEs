import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DropdownProps {
  trigger: (opts: { open: boolean; toggle: () => void }) => ReactNode;
  children: (opts: { close: () => void }) => ReactNode;
  align?: 'left' | 'right';
  panelClassName?: string;
}

/** Menu tha xuong don gian, dong khi click ra ngoai hoac nhan Esc. Dung cho user menu & thong bao. */
export function Dropdown({ trigger, children, align = 'right', panelClassName }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={cn(
            'absolute z-40 mt-2 animate-slide-up rounded-xl border border-slate-200 bg-white shadow-xl',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
