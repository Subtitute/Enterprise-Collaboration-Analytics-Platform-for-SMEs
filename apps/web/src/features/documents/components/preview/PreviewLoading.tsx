import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';

// 27/10/2026: trang thai "Dang tai ban xem truoc" dung chung cho FilePreviewModal (luc lay URL/tai
// noi dung) va 3 trinh xem Office (luc nap chunk lazy + phan tich tep) - truoc day viet thang trong modal.
export function PreviewLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Spinner size="md" />
      <p className="text-[12px] font-medium text-text-tertiary">{t('documents:preview.loading')}</p>
    </div>
  );
}

/** PreviewLoading can giua vung xem truoc (dung lam fallback cua Suspense va luc dang phan tich). */
export function PreviewLoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-subtle">
      <PreviewLoading />
    </div>
  );
}
