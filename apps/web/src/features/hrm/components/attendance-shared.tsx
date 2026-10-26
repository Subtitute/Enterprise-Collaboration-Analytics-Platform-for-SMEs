import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { CameraIcon, MapPinIcon } from '@/components/ui/Icons';
import { getAttendancePhotoUrl } from '../api';

/**
 * 13/08/2026 (Technical_Spec.md muc 17): huy hieu co "on-site"/"off-site" - `null`/`undefined`
 * (chua co du lieu de danh gia) KHONG hien gi ca, CHI hien khi co ket qua ro rang. Day la tin
 * hieu THEM cho Manager doi chieu voi anh, khong phai trang thai loi/canh bao chan cham cong.
 */
// 03/10/2026: export - AttendanceDetailPage.tsx (trang chi tiet cham cong 1 nhan vien,
// /attendance/:userId) tai su dung nguyen ham nay thay vi chep lai, mirror cach PhotoProofModal/
// AttendanceStatusBadge/formatTotalHours/getTodayGmt7 duoi day cung duoc export cho cung muc dich.
// 26/10/2026 - Rà soát responsive 390px/768px/1366px: thêm whitespace-nowrap và shrink-0 để badge không bị vỡ dòng
export function OnSiteBadge({ isOnSite }: { isOnSite?: boolean | null }) {
  const { t } = useTranslation();
  if (isOnSite === undefined || isOnSite === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap shrink-0 ${isOnSite ? 'text-emerald-600' : 'text-amber-600'}`}
      title={isOnSite ? t('hrm:attendancePage.onSiteBadge.onSiteTitle') : t('hrm:attendancePage.onSiteBadge.offSiteTitle')}
    >
      <MapPinIcon className="h-3 w-3" />
      {isOnSite ? t('hrm:attendancePage.onSiteBadge.onSite') : t('hrm:attendancePage.onSiteBadge.offSite')}
    </span>
  );
}

/**
 * 24/10/2026 (Face recognition): mirror CHINH XAC OnSiteBadge o tren - CANH BAO MEM, KHONG hien
 * gi ca khi `matched` la null/undefined (chua dang ky khuon mat/khong phat hien duoc mat trong
 * anh), chi hien khi co ket qua ro rang. Hien kem % diem tuong dong de Manager tu doi chieu.
 * Merge nhanh Frontend2: chuyen tu AttendancePage.tsx sang day cung OnSiteBadge.
 */
// 26/10/2026 - Rà soát responsive 390px/768px/1366px: thêm whitespace-nowrap và shrink-0 để badge không bị vỡ dòng trong bảng và card
export function FaceMatchBadge({ matched, score }: { matched?: boolean | null; score?: number | null }) {
  const { t } = useTranslation();
  if (matched === undefined || matched === null) return null;
  const percent = score != null ? Math.round(Math.max(0, score) * 100) : null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap shrink-0 ${matched ? 'text-emerald-600' : 'text-amber-600'}`}
      title={matched ? t('hrm:attendancePage.faceMatchBadge.matchedTitle') : t('hrm:attendancePage.faceMatchBadge.notMatchedTitle')}
    >
      <CameraIcon className="h-3 w-3" />
      {matched ? t('hrm:attendancePage.faceMatchBadge.matched') : t('hrm:attendancePage.faceMatchBadge.notMatched')}
      {percent !== null && ` (${percent}%)`}
    </span>
  );
}

/**
 * Tính tổng số giờ làm việc giữa check-in và check-out (Ví dụ: 8.5 giờ)
 * 16/09/2026: gop merge - ca 2 nhanh deu tu them 1 key i18n rieng cho chuoi "X giờ"
 * (totalHoursValue vs hoursUnit). Giu totalHoursValue (di kem kieu TFunction da co san import
 * o dau file), xoa hoursUnit khoi hrm.json (vi/en/ja) vi khong con noi nao goi toi.
 */
export function formatTotalHours(t: TFunction, checkInAt?: string | null, checkOutAt?: string | null): string {
  if (!checkInAt || !checkOutAt) return '—';
  const start = new Date(checkInAt).getTime();
  const end = new Date(checkOutAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '—';
  const diffHours = (end - start) / (1000 * 60 * 60);
  return t('hrm:attendancePage.totalHoursValue', { hours: diffHours.toFixed(1) });
}

export type ViewingPhotoTarget = {
  id: string;
  kind: 'checkin' | 'checkout';
  time: string;
  userName?: string;
  isOnSite?: boolean | null;
  // 24/10/2026 (Face recognition): diem khop + co khop cua dung lan cham cong dang xem anh.
  faceMatched?: boolean | null;
  faceMatchScore?: number | null;
};

/**
 * Modal hiển thị ảnh chụp bằng chứng chấm công (Photo-Proof Modal)
 */
export function PhotoProofModal({
  target,
  onClose,
}: {
  target: ViewingPhotoTarget | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!target) {
      setPhotoUrl(null);
      setIsLoading(false);
      setError(false);
      return;
    }
    let isMounted = true;
    setIsLoading(true);
    setError(false);

    getAttendancePhotoUrl(target.id, target.kind)
      .then((url) => {
        if (isMounted) {
          setPhotoUrl(url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(true);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [target]);

  if (!target) return null;

  const actionText = target.kind === 'checkin' ? t('hrm:attendancePage.photoModal.actionCheckIn') : t('hrm:attendancePage.photoModal.actionCheckOut');

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-[16px] leading-[24px] font-semibold text-text-primary">
          <CameraIcon className="h-4 w-4 text-accent" />
          <span>{t('hrm:attendancePage.photoModal.title', { action: actionText })}</span>
        </div>
      }
      size="sm"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('hrm:attendancePage.photoModal.close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs bg-bg-subtle p-2.5 rounded-radius-sm border border-border-subtle">
          <div>
            <span className="font-semibold text-text-primary">{target.userName || t('hrm:attendancePage.photoModal.personal')}</span>
            <div className="font-mono text-text-primary font-medium mt-0.5 tabular-nums">{target.time}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <OnSiteBadge isOnSite={target.isOnSite} />
            <FaceMatchBadge matched={target.faceMatched} score={target.faceMatchScore} />
          </div>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-radius-md bg-slate-900 border border-border-subtle flex items-center justify-center">
          {isLoading && (
            <div className="flex flex-col items-center gap-2 text-accent">
              <Spinner className="h-8 w-8 text-accent" />
              <span className="text-xs text-text-tertiary">{t('hrm:attendancePage.photoModal.loading')}</span>
            </div>
          )}
          {error && (
            <div className="p-4 text-center text-xs text-error">
              {t('hrm:attendancePage.photoModal.error')}
            </div>
          )}
          {photoUrl && !isLoading && (
            <img src={photoUrl} alt={t('hrm:attendancePage.photoModal.imageAlt')} className="h-full w-full object-cover" />
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Hệ thống Nhãn trạng thái (Status Badges) cho chấm công:
 * - Đúng giờ (bg-emerald-100 text-emerald-700)
 * - Đi muộn (bg-amber-100 text-amber-700)
 * - Quên check-out (bg-rose-100 text-rose-600)
 */
export function AttendanceStatusBadge({
  record,
  today,
  isAdjusted = false,
  isPendingAdjustment = false,
}: {
  record: { workDate: string; checkInAt: string; checkOutAt?: string | null };
  today: string;
  isAdjusted?: boolean;
  isPendingAdjustment?: boolean;
}) {
  const { t } = useTranslation();

  if (isPendingAdjustment) {
    return (
      <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        <span className="h-1 w-1 rounded-full bg-amber-500" />
        {t('hrm:extensions.adjustment.badge.pending')}
      </span>
    );
  }

  if (isAdjusted) {
    return (
      <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-accent-soft text-accent whitespace-nowrap">
        <span className="h-1 w-1 rounded-full bg-accent" />
        {t('hrm:extensions.adjustment.badge.adjusted')}
      </span>
    );
  }

  const checkInDate = new Date(record.checkInAt);
  const gmt7Parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(checkInDate);
  const checkInHour = Number(gmt7Parts.find((p) => p.type === 'hour')?.value ?? 0);
  const checkInMinute = Number(gmt7Parts.find((p) => p.type === 'minute')?.value ?? 0);
  const isLate = checkInHour > 8 || (checkInHour === 8 && checkInMinute > 30); // Giờ chuẩn vào ca 8:30
  const isPastDay = record.workDate < today;
  const isMissingCheckOut = !record.checkOutAt && isPastDay;

  if (isMissingCheckOut) {
    return (
      <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-error-soft text-error whitespace-nowrap">
        <span className="h-1 w-1 rounded-full bg-error" />
        {t('hrm:attendancePage.statusBadge.missingCheckOut')}
      </span>
    );
  }

  if (isLate) {
    return (
      <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-warning-soft text-warning whitespace-nowrap">
        <span className="h-1 w-1 rounded-full bg-warning" />
        {t('hrm:attendancePage.statusBadge.late')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-success-soft text-success whitespace-nowrap">
      <span className="h-1 w-1 rounded-full bg-success" />
      {t('hrm:attendancePage.statusBadge.onTime')}
    </span>
  );
}

/** Ngay hien tai theo lich GMT+7, dang 'YYYY-MM-DD' - dung 'en-CA' vi dinh dang chuan cua locale
 *  nay trung khop ISO date (YYYY-MM-DD), tranh phai tu ghep chuoi thu cong. */
export function getTodayGmt7(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

/**
 * 16/10/2026: Badge hien thi loai nghi phep tren bang cham cong ca nhan cho cac ngay co don da duyet.
 * Design System v1.1: h22, padding 2x8, rounded-[2px], font 11/600, dot 4px.
 */
export function LeaveAttendanceBadge({ rawType, label }: { rawType: string | null; label: string | null }) {
  if (!label) return null;
  let bgClass = 'bg-[#FAF9F6] text-[#5C5A55]';
  let dotClass = 'bg-[#5C5A55]';

  const typeUpper = (rawType || '').toUpperCase();
  if (typeUpper === 'ANNUAL' || label.includes('năm') || label.includes('Annual') || label.includes('有給')) { // i18n-lint-ignore - gia tri SO KHOP du lieu, khong phai text hien thi
    bgClass = 'bg-[#E4EFEE] text-[#0E5E5E]';
    dotClass = 'bg-[#0E5E5E]';
  } else if (typeUpper === 'SICK' || label.includes('ốm') || label.includes('Sick') || label.includes('病気')) { // i18n-lint-ignore - gia tri SO KHOP du lieu, khong phai text hien thi
    bgClass = 'bg-[#FBEEE0] text-[#B45309]';
    dotClass = 'bg-[#B45309]';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold shrink-0 ${bgClass}`}>
      <span className={`h-1 w-1 rounded-full shrink-0 ${dotClass}`} />
      <span>{label}</span>
    </span>
  );
}
