import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ClockIcon } from '@/components/ui/Icons';
import { cn, formatDate } from '@/lib/utils';
import { usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import { useMyFaceStatusQuery } from '@/features/face/hooks';

export const FACE_SECTION_ID = 'face-enrollment';

/**
 * 26/10/2026: banner khi Org Admin/Manager/nhap Excel da tai anh nhan dien cho chinh nguoi dang xem
 * (Technical_Spec.md muc 27.8, Wireframe muc 16.5) - khong can producer Kafka moi, chi doc
 * GET /ml/face/enrollment. Anh CHUA dung de doi chieu cho toi khi chinh chu xac nhan.
 */
export function FacePendingBanner({ className }: { className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canCheckIn = usePermissions().includes(PERMISSIONS.ATTENDANCE_CHECKIN);
  const { data } = useMyFaceStatusQuery({ enabled: canCheckIn });
  if (!data?.pending) return null;

  function handleView() {
    navigate(`/profile#${FACE_SECTION_ID}`);
    document.getElementById(FACE_SECTION_ID)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-2 rounded-radius-md border border-warning/30 bg-warning-soft px-4 py-3 text-[13px] text-text-primary sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>{t('profile:faceBanner.message', { date: formatDate(data.pending.expiresAt) })}</span>
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={handleView} className="shrink-0">
        {t('profile:faceBanner.viewNow')}
      </Button>
    </div>
  );
}
