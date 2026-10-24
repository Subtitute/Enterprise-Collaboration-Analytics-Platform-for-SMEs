import { memo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { AlertTriangleIcon } from '@/components/ui/Icons';
import type { PlatformOrganization } from '@/types';

interface DeactivateConfirmModalProps {
  org: PlatformOrganization | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeactivateConfirmModal = memo(function DeactivateConfirmModal({
  org,
  isLoading,
  onClose,
  onConfirm,
}: DeactivateConfirmModalProps) {
  const { t } = useTranslation();
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (org) {
      // Focus mac dinh vao nut Huy de ngan chan bam nham khoa to chuc
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [org]);

  if (!org) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1C1B1A]/50 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactivate-dialog-title"
        className="relative z-10 w-full max-w-[360px] rounded-radius-lg border border-border-subtle bg-white p-6 shadow-lg animate-slide-up"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
            <AlertTriangleIcon className="h-8 w-8 text-[#B45309]" />
          </div>
          <h2 id="deactivate-dialog-title" className="mt-3 text-[16px] leading-[24px] font-semibold text-text-primary">
            {t('platformAdmin:page.deactivateConfirm.title')}
          </h2>
          <p className="mt-2 text-[13px] leading-[20px] text-text-secondary">
            {t('platformAdmin:page.deactivateConfirm.description', { name: org.name })}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-radius-sm border border-border-strong bg-white px-4 text-[13px] font-medium text-text-primary hover:bg-bg-subtle transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
          >
            {t('common:actions.cancel')}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="inline-flex h-9 items-center justify-center rounded-radius-sm bg-[#B3261E] hover:bg-[#8F1D18] px-4 text-[13px] font-medium text-white disabled:opacity-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
          >
            {t('platformAdmin:page.deactivateConfirm.confirmLabel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
});

