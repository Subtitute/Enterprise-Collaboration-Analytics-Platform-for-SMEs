import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/Modal';
import { AlertCircleIcon, CameraIcon, CheckCircleIcon, TrashIcon } from '@/components/ui/Icons';
import { formatDateTime } from '@/lib/utils';
import { CheckInCamera } from '@/features/hrm/components/CheckInCamera';
import { useDeleteFaceEnrollment, useEnrollFace, useFaceEnrollmentStatusQuery } from '@/features/hrm/hooks';

/**
 * 24/10/2026: Face recognition (verify 1:1 cho cham cong, canh bao MEM) - dang ky/xoa khuon mat CUA
 * CHINH nguoi dang xem, mirror tinh than "tu phuc vu" cua Cham cong/Nghi phep. Opt-in that su (o dong
 * y BAT BUOC tick truoc khi bam dang ky) vi day la du lieu sinh trac hoc - xem Technical_Spec.md §24.
 * Merge nhanh Frontend2 (24/10/2026): ProfilePage da tach thanh cac card rieng, card nay tach theo
 * cung kieu (tu quan ly state + camera + hop xac nhan xoa).
 */
export const ProfileFaceEnrollmentCard = memo(function ProfileFaceEnrollmentCard() {
  const { t } = useTranslation();
  const faceEnrollmentQuery = useFaceEnrollmentStatusQuery();
  const enrollFaceMutation = useEnrollFace();
  const deleteFaceEnrollmentMutation = useDeleteFaceEnrollment();
  const [faceConsentChecked, setFaceConsentChecked] = useState(false);
  const [isFaceCameraOpen, setIsFaceCameraOpen] = useState(false);
  const [isDeleteFaceConfirmOpen, setIsDeleteFaceConfirmOpen] = useState(false);

  function handleEnrollFacePhoto(photo: Blob) {
    enrollFaceMutation.mutate(photo, { onSuccess: () => setIsFaceCameraOpen(false) });
  }

  // 24/10/2026 (fix phat hien qua QA doc lap): xoa dang ky xong PHAI buoc tick lai o dong y o lan
  // dang ky tiep theo - neu khong, rut lai dong y roi dang ky lai khong can opt-in moi, lam vo
  // nghia yeu cau "dong y THAT SU" ban dau (du lieu sinh trac hoc).
  function handleDeleteFaceEnrollment() {
    deleteFaceEnrollmentMutation.mutate(undefined, {
      onSuccess: () => {
        setIsDeleteFaceConfirmOpen(false);
        setFaceConsentChecked(false);
      },
    });
  }

  return (
    <>
      {/* 26/10/2026 - Rà soát chuẩn phẳng Zero-shadow, viền 1px border-border-subtle, tông Teal #0E5E5E */}
      <Card className="border border-border-subtle bg-bg-surface rounded-radius-md shadow-none">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-radius-sm bg-accent-soft text-accent">
              <CameraIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-[15px] font-semibold text-text-primary">
                {t('hrm:faceEnroll.sectionTitle')}
              </CardTitle>
              <CardDescription className="text-[13px] text-text-secondary">
                {t('hrm:faceEnroll.sectionDesc')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          {/* 24/10/2026 (fix phat hien qua QA doc lap): truoc day chi kiem tra isLoading roi doc
              thang data?.enrolled - loi 5xx/403 (vd ml-service tam thoi khong ket noi duoc) khien
              `data` la undefined, roi xuong NHANH "chua dang ky" va hien form dong y/dang ky thay
              vi bao loi ro rang. */}
          {faceEnrollmentQuery.isLoading ? (
            <Spinner className="h-5 w-5 text-accent" />
          ) : faceEnrollmentQuery.isError ? (
            <div className="flex items-center justify-between gap-2.5 rounded-radius-sm border border-danger/20 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
              <span>{t('hrm:faceEnroll.loadError')}</span>
              <Button type="button" variant="secondary" size="sm" onClick={() => faceEnrollmentQuery.refetch()}>
                {t('common:queryState.retry')}
              </Button>
            </div>
          ) : faceEnrollmentQuery.data?.enrolled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-radius-sm border border-success/20 bg-success-soft px-3 py-2.5 text-[13px] text-success">
                <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {t('hrm:faceEnroll.enrolledAt', {
                    date: faceEnrollmentQuery.data.enrolledAt ? formatDateTime(faceEnrollmentQuery.data.enrolledAt) : '—',
                  })}
                </span>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsFaceCameraOpen(true)}>
                  <CameraIcon className="h-3.5 w-3.5 mr-1.5" />
                  {t('hrm:faceEnroll.reEnrollButton')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setIsDeleteFaceConfirmOpen(true)}>
                  <TrashIcon className="h-3.5 w-3.5 mr-1.5" />
                  {t('hrm:faceEnroll.deleteButton')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="flex items-start gap-2.5 text-[13px] text-text-secondary cursor-pointer">
                <Checkbox checked={faceConsentChecked} onChange={(e) => setFaceConsentChecked(e.target.checked)} className="mt-0.5" />
                <span>{t('hrm:faceEnroll.consentLabel')}</span>
              </label>
              <Button type="button" variant="primary" disabled={!faceConsentChecked} onClick={() => setIsFaceCameraOpen(true)}>
                <CameraIcon className="h-3.5 w-3.5 mr-1.5" />
                {t('hrm:faceEnroll.enrollButton')}
              </Button>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-radius-sm border border-[#1E5A8A]/20 bg-[#E4EEF5] px-3 py-2.5 text-[13px] leading-[20px] text-[#1E5A8A]">
            <AlertCircleIcon className="h-3.5 w-3.5 shrink-0 text-[#1E5A8A] mt-0.5" />
            <p className="font-normal">{t('hrm:faceEnroll.softWarningNote')}</p>
          </div>
        </CardContent>
      </Card>

      <CheckInCamera
        open={isFaceCameraOpen}
        onClose={() => setIsFaceCameraOpen(false)}
        onConfirm={handleEnrollFacePhoto}
        isSubmitting={enrollFaceMutation.isPending}
        mode="enroll"
      />

      <ConfirmDialog
        open={isDeleteFaceConfirmOpen}
        onClose={() => setIsDeleteFaceConfirmOpen(false)}
        onConfirm={handleDeleteFaceEnrollment}
        title={t('hrm:faceEnroll.deleteConfirmTitle')}
        description={t('hrm:faceEnroll.deleteConfirmDescription')}
        danger
        isLoading={deleteFaceEnrollmentMutation.isPending}
      />
    </>
  );
});
