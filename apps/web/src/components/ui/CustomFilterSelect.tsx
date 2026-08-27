import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { ChevronDownIcon, CheckIcon } from '@/components/ui/Icons';

export interface FilterOption {
  value: string;
  label: string;
}

interface CustomFilterSelectProps {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  align?: 'left' | 'right';
}

export function CustomFilterSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  align = 'left',
}: CustomFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; right: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next && rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 6,
          left: rect.left,
          right: window.innerWidth - rect.right,
          width: Math.max(rect.width, 160),
        });
      }
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;

    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    // 26/08/2026: sua loi ro ri bo lang nghe thuc te - addEventListener va removeEventListener
    // truoc do moi ben truyen 1 ham arrow noi tuyen RIENG (2 tham chieu ham khac nhau), ma
    // removeEventListener chi khop khi truyen DUNG CUNG 1 tham chieu ham da dung khi addEventListener
    // (theo dung DOM spec) - nen lenh remove khong bao gio thuc su go duoc listener resize da gan,
    // moi lan mo dropdown lai cong don them 1 listener "resize" moi vinh vien tren window (khong bao
    // gio giai phong, tich luy khi component unmount/re-mount nhieu lan). Sua theo dung mau da dung
    // dung o Dropdown.tsx (`close`/`onScroll` khai bao 1 lan, dung LAI CHINH tham chieu do cho ca
    // 2 loi goi): tach handler thanh 1 hang so duy nhat, dung chung 1 tham chieu cho ca add va remove.
    const handleResize = () => setOpen(false);

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative inline-block text-left', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={cn(
          'flex h-8 items-center justify-between gap-2 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
          open && 'border-primary-500 ring-2 ring-primary-500/20 bg-slate-50/50',
        )}
      >
        <span className="truncate max-w-[140px] text-slate-800">{selectedOption?.label}</span>
        <ChevronDownIcon
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200',
            open && 'rotate-180 text-primary-600',
          )}
        />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: position.top,
              minWidth: position.width,
              ...(align === 'right' ? { right: position.right } : { left: position.left }),
            }}
            className="z-40 animate-slide-up overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 p-1 text-xs shadow-xl shadow-slate-200/70 backdrop-blur-md transition-all duration-300 ease-out"
          >
            <div className="max-h-60 overflow-y-auto py-0.5 space-y-0.5">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'group flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-all duration-150',
                      isSelected
                        ? 'bg-primary-50 font-semibold text-primary-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-primary-600 animate-fade-in" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
