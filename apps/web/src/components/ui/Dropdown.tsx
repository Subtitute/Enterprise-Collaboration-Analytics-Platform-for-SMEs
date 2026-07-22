import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DropdownProps {
  trigger: (opts: { open: boolean; toggle: () => void }) => ReactNode;
  children: (opts: { close: () => void }) => ReactNode;
  align?: 'left' | 'right';
  panelClassName?: string;
}

interface PanelPosition {
  top: number;
  left: number;
  right: number;
}

/**
 * Menu tha xuong don gian, dong khi click ra ngoai hoac nhan Esc. Dung cho user menu, thong
 * bao, hanh dong theo dong trong bang...
 *
 * 22/07/2026: sua loi thuc te - khi Dropdown nam trong 1 bang co the cuon ngang (component
 * Table dung `md:overflow-x-auto`, theo CSS spec dieu nay ep `overflow-y` ve `auto`), panel
 * tuyet doi (`position: absolute`) cu bi CLIP boi chinh khung bang chua no vi panel nam NGOAI
 * luong binh thuong nen khong duoc tinh vao chieu cao cha - ket qua la nguoi dung bam nut "..."
 * (vd FileTable) nhung khong thay menu hien ra du no van "mo" ve mat state. Sua bang cach dua
 * panel ra ngoai qua React Portal (giong Modal.tsx da lam) roi tu tinh vi tri bang
 * `getBoundingClientRect()` cua nut trigger - loai bo hoan toan moi anh huong tu overflow cua
 * cha, ap dung dung cho MOI noi dang dung Dropdown (khong chi rieng bang tai lieu).
 */
export function Dropdown({ trigger, children, align = 'right', panelClassName }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next && rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect();
        setPosition({ top: rect.bottom + 8, left: rect.left, right: window.innerWidth - rect.right });
      }
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // 22/07/2026: sua loi thuc te - dung `close` (bare) lam listener cho scroll capture-phase se
    // dong Dropdown khi cuon BAT KY noi nao trong document, KE CA khi cuon ben trong chinh panel
    // cua no. NotificationBell (danh sach thong bao co `overflow-y-auto max-h-[26rem]`, thuong
    // dai hon khung hien thi) la vi du dien hinh: nguoi dung vua mo panel, vua lan chuot de doc
    // tiep danh sach thi panel da tu dong bien mat. Nguyen nhan la mousewheel/touch scroll BEN
    // TRONG panel van la 1 scroll event tren mot phan tu con chau, va no bubble/capture qua
    // window nhu moi scroll khac. Sua: kiem tra target cua scroll event co nam trong panelRef
    // (panel duoc render qua createPortal nen e.target van dung la node con chau cua panelRef) -
    // neu co thi bo qua, chi dong khi scroll That su xay ra o NGOAI panel (vd. cuon trang chinh
    // lam nut trigger troi khoi vi tri cu).
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    // Dong menu khi cuon/resize thay vi bam theo (giu don gian, dung du cho cac danh sach ngan
    // trong pham vi do an) - tranh menu "troi" sai vi tri so voi nut trigger da di chuyen.
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      {trigger({ open, toggle })}
      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: position.top, ...(align === 'right' ? { right: position.right } : { left: position.left }) }}
            className={cn('z-40 animate-slide-up rounded-xl border border-slate-200 bg-white shadow-xl', panelClassName)}
          >
            {children({ close: () => setOpen(false) })}
          </div>,
          document.body,
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
