import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// 28/07/2026: danh sach the co the nhan focus, dung chung cho focus-trap ben duoi (bo qua phan tu
// dang bi disabled hoac tabindex=-1 - khong the/khong nen nhan focus qua Tab).
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  // 26/08/2026: prop moi - gom "chan dong modal khi dang co mutation pending" VE MOT CHO DUY NHAT
  // trong Modal.tsx, thay vi de tung modal con tu viet 1 ham handleClose rieng kiem tra isPending
  // truoc khi goi onClose (DepartmentModal/EditMemberModal/InviteMemberModal/UploadModal hom qua
  // moi noi lam 1 kieu, de sot la lai bi lo - xem UploadModal.tsx ban truoc, Fix 7). Khi true: ca
  // 3 duong dong hien co (nut X o header, phim Escape, click ra ngoai overlay) deu bi Modal tu
  // chan (no-op), modal con CHI can truyen preventCloseWhilePending={mutation.isPending}.
  //
  // 27/08/2026 (ghi nhan qua ra soat lai, KHONG sua): danh doi co chu dich - neu request hang vo
  // thoi han (apiClient khong dat `timeout`, moi mutation cau hinh `retry: 0`), nguoi dung se KHONG
  // co cach nao dong modal nay tu trong app (ca 3 duong dong deu bi chan) toi khi request that su
  // tra ve (thanh cong/loi) hoac nguoi dung tu tai lai trang. Chap nhan danh doi nay vi loi ich
  // (tranh mat du lieu dang nhap dang do/dong nham modal do closure `onSuccess` cu) lon hon rui ro
  // (request hang that su hiem, va van co loi thoat tho bang F5). Neu sau nay can xu ly triet de
  // hon, them `timeout` cho apiClient (apps/web/src/lib/api-client.ts) la huong sua dung goc re.
  preventCloseWhilePending?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  preventCloseWhilePending,
}: ModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // 20/08/2026: sua loi thuc te - hau het noi goi Modal truyen `onClose` la 1 ham MOI moi lan
  // component cha render (vd `function handleClose() {...}` khai bao lai trong than component,
  // khong boc useCallback - xem InviteMemberModal.tsx). Truoc day `onClose` nam trong dependency
  // array cua effect quan ly focus ben duoi, nen MOI lan nguoi dung go 1 ky tu vao 1 input trong
  // modal (setState -> re-render -> `onClose` doi tham chieu) effect chay lai TU DAU, bao gom ca
  // buoc "focus phan tu co the nhan focus DAU TIEN trong dialog" - nut Dong (X) o header luon la
  // phan tu do (dung truoc form trong DOM), nen focus bi giat khoi o dang go sang nut Dong ngay
  // sau MOI ky tu. Luu `onClose` vao ref, cap nhat moi render (khong can effect rieng), de
  // handler Escape ben duoi luon goi ban moi nhat MA effect chinh KHONG can `onClose` trong
  // dependency array nua - chi con phu thuoc `open` (dung nhu y dinh: chay 1 lan khi modal MO).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // 26/08/2026: cung ly do nhu onCloseRef ngay tren - handler Escape dang ky trong effect chi phu
  // thuoc `open` (khong muon effect focus-trap chay lai moi lan cha re-render), nen phai doc
  // preventCloseWhilePending qua ref cap nhat moi render, khong the dua thang bien props vao vi
  // closure cua effect se giu gia tri CU tai thoi diem effect chay (luc modal vua mo, isPending
  // luc do luon la false).
  const preventCloseRef = useRef(preventCloseWhilePending);
  preventCloseRef.current = preventCloseWhilePending;

  // 26/08/2026: ham dong duy nhat cho nut X o header va click ra ngoai overlay (2 duong con lai
  // ngoai Escape) - chan tai day khi preventCloseWhilePending=true, xem giai thich tai khai bao
  // prop nay trong ModalProps.
  function requestClose() {
    if (preventCloseWhilePending) return;
    onClose();
  }

  // 28/07/2026: bo sung quan ly focus (phat hien qua ra soat kha nang tiep can) - truoc do Modal
  // KHONG chuyen focus vao trong dialog khi mo (nguoi dung ban phim van dang o phan tu vua bam mo
  // modal, Tab tiep theo di THANG qua noi dung trang PHIA SAU lop overlay, du lop do dang chan
  // chuot ve mat thi giac) va KHONG tra focus ve nut da mo modal khi dong (mat "vi tri" dieu huong
  // ban phim). Sua bang: (a) luu lai phan tu dang focus truoc khi mo, tra ve khi dong; (b) focus
  // phan tu co the nhan focus DAU TIEN trong dialog ngay khi mo (hoac chinh dialog neu khong co);
  // (c) "nhot" Tab/Shift+Tab trong pham vi dialog (focus trap) - Tab tai phan tu cuoi vong ve dau,
  // Shift+Tab tai phan tu dau vong ve cuoi, khong cho thoat ra ngoai qua ban phim.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? dialogRef.current)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (preventCloseRef.current) return;
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={requestClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-lg animate-slide-up',
          sizeClasses[size],
        )}
      >
        {title && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-4 bg-slate-50/50">
            <div className="pt-0.5 flex-1 min-w-0">
              {typeof title === 'string' ? (
                <h2 className="text-base font-bold text-slate-900 truncate tracking-tight">{title}</h2>
              ) : (
                title
              )}
              {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label={t('common:actions.close')}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <CloseIcon />
            </button>
          </div>
        )}
        <div className="overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] max-h-[calc(90vh-140px)] px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200/80 px-5 py-3 bg-slate-50/40">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger,
  isLoading,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  isLoading?: boolean;
  children?: ReactNode;
}) {
  // Lazy import de tranh vong lap phu thuoc (Button dung Spinner, khong lien quan Modal)
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      {children}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {cancelLabel ?? t('common:actions.cancel')}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={onConfirm}
          className={cn(
            'inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-white disabled:opacity-50',
            danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700',
          )}
        >
          {confirmLabel ?? t('common:actions.confirm')}
        </button>
      </div>
    </Modal>
  );
}
