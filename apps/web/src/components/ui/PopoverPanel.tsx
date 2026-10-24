import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface PopoverPanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number | string;
  maxHeight?: string;
  className?: string;
  align?: 'right' | 'left';
  'aria-label'?: string;
}

/**
 * PopoverPanel (DS v0.4): Khung popover tái sử dụng cho Notification Dropdown, Chat Preview, Search full panel...
 * - Mặc định width: 400px (fixed, không min-w)
 * - Max-height: min(560px, calc(100vh - 120px))
 * - Nền: bg-surface, viền: border-subtle, radius: radius-md (6px), shadow: shadow-md
 * - Xử lý click-outside, phím Escape
 */
export function PopoverPanel({
  open,
  onClose,
  children,
  width = 400,
  maxHeight = 'min(560px, calc(100vh - 120px))',
  className,
  align = 'right',
  'aria-label': ariaLabel,
}: PopoverPanelProps) {
  const { t } = useTranslation();
  const resolvedAriaLabel = ariaLabel ?? t('common:popover.defaultAriaLabel');
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);


  if (!open) return null;

  const styleWidth = typeof width === 'number' ? `${width}px` : width;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={resolvedAriaLabel}
      tabIndex={-1}
      style={{
        width: styleWidth,
        maxHeight,
      }}
      className={cn(
        'absolute top-full z-50 mt-2 flex flex-col overflow-hidden rounded-radius-md border border-border-subtle bg-bg-surface shadow-md focus:outline-none animate-slide-up',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
