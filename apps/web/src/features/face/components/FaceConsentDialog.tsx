import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Input';

/**
 * 26/10/2026: hop dong y co phien ban (face-consent-v1, Technical_Spec.md muc 27.8, Wireframe muc
 * 16.5) - nut Dong y khoa toi khi tick. Dong y duoc GHI O SERVER (face_consents) khi tu dang ky
 * hoac xac nhan anh cho, khong con chi la state phia client nhu truoc.
 */
export function FaceConsentDialog({
  open,
  onClose,
  onAgree,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onAgree: () => void;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (open) setChecked(false);
  }, [open]);

  const points = ['purpose', 'stored', 'noImpact', 'deletion'] as const;
  return (
    <Modal open={open} onClose={onClose} title={t('hrm:face.consent.title')} preventCloseWhilePending={isLoading}>
      <div className="space-y-4">
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-5 text-text-secondary">
          {points.map((p) => (
            <li key={p}>{t(`hrm:face.consent.${p}`)}</li>
          ))}
        </ul>
        <label className="flex items-start gap-2.5 text-[13px] text-text-primary cursor-pointer">
          <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
          <span>{t('hrm:face.consent.checkbox')}</span>
        </label>
        <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            {t('hrm:face.consent.cancel')}
          </Button>
          <Button type="button" onClick={onAgree} disabled={!checked} isLoading={isLoading}>
            {t('hrm:face.consent.agree')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
