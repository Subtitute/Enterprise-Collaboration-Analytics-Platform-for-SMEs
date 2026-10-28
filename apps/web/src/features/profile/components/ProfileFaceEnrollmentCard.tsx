import { memo, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { AlertCircleIcon, CameraIcon, CheckCircleIcon, ClockIcon, TrashIcon, UploadIcon } from '@/components/ui/Icons';
import { formatDate, formatDateTime } from '@/lib/utils';
import { toast } from '@/stores/toast.store';
import { ImageNormalizeError, normalizeFacePhoto } from '@/lib/image-normalize';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { CheckInCamera } from '@/features/hrm/components/CheckInCamera';
import { fetchMyFacePhoto } from '@/features/face/api';
import {
  useConfirmMyPendingFace,
  useEnrollMyFace,
  useMyFaceStatusQuery,
  useRejectMyPendingFace,
  useWithdrawMyFace,
} from '@/features/face/hooks';
import { FaceConsentDialog } from '@/features/face/components/FaceConsentDialog';
import { FacePhotoBox } from '@/features/face/components/FacePhotoBox';
import { canUseWebcam } from '@/features/face/camera';
import { FACE_SECTION_ID } from './FacePendingBanner';

type ConsentIntent = 'camera' | 'upload' | 'confirm' | null;

/**
 * 24/10/2026: Face recognition (verify 1:1 cho cham cong, canh bao MEM) - dang ky/xoa khuon mat CUA
 * CHINH nguoi dang xem. Merge nhanh Frontend2 (24/10/2026): ProfilePage da tach thanh cac card rieng.
 *
 * 26/10/2026: viet lai theo kho anh nhan dien + dong y (Technical_Spec.md muc 27.8, Wireframe muc
 * 16.5): xem anh dang dung + anh CHO (qua proxy, khong cache), xac nhan/tu choi anh do quan tri vien
 * tai ho, tu dang ky bang camera HOAC tai anh tu may (chuan hoa JPEG o trinh duyet), xoa = rut lai
 * dong y. Dong y ghi o server (face-consent-v1) thay vi chi la o tick phia client.
 *
 * 27/10/2026: trinh duyet khong mo duoc webcam (dien thoai vao qua http LAN, khong co getUserMedia)
 * thi nut camera mo app camera qua <input accept="image/*" capture="user"> thay vi modal bao "khong
 * ho tro" - anh di cung duong chuan hoa JPEG nhu "Tai anh tu may" (nguon SELF_CAMERA).
 */
export const ProfileFaceEnrollmentCard = memo(function ProfileFaceEnrollmentCard() {
  const { t } = useTranslation();
  const location = useLocation();
  const statusQuery = useMyFaceStatusQuery();
  const enroll = useEnrollMyFace();
  const confirmPending = useConfirmMyPendingFace();
  const rejectPending = useRejectMyPendingFace();
  const withdraw = useWithdrawMyFace();
  const { map: userNameMap } = useUserNameMap();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const webcam = canUseWebcam();
  const [consentIntent, setConsentIntent] = useState<ConsentIntent>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [largePhoto, setLargePhoto] = useState<string | null>(null);

  useEffect(() => {
    if (location.hash === `#${FACE_SECTION_ID}`) document.getElementById(FACE_SECTION_ID)?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash, statusQuery.data]);

  const data = statusQuery.data;

  function handleConsentAgree() {
    const intent = consentIntent;
    if (intent === 'confirm') {
      confirmPending.mutate(undefined, { onSuccess: () => setConsentIntent(null) });
      return;
    }
    setConsentIntent(null);
    // Mo hop chon tep NGAY trong su kien bam (cu chi nguoi dung) - trinh duyet moi cho phep.
    if (intent === 'upload') fileInputRef.current?.click();
    if (intent === 'camera') {
      if (webcam) setIsCameraOpen(true);
      else captureInputRef.current?.click();
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>, source: 'SELF_CAMERA' | 'SELF_UPLOAD') {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      enroll.mutate({ photo: await normalizeFacePhoto(file), source });
    } catch (err) {
      toast.error(t('hrm:faceEnroll.toasts.enrollError'), t(err instanceof ImageNormalizeError ? 'errors:FACE_INVALID_IMAGE' : 'common:genericError'));
    }
  }

  const pendingActor = data?.pending ? userNameMap[data.pending.actorId] ?? t('hrm:face.unknownActor') : '';
  // 28/10/2026: dang gui anh tu the nay (khong qua modal webcam) -> spinner dung nut vua bam (camera qua
  // input capture hoac "Tai anh tu may") va khoa ca 2 nut; truoc day spinner luon o nut tai anh.
  const enrollingFromCard = enroll.isPending && !isCameraOpen;
  const enrollingSource = enrollingFromCard ? enroll.variables?.source : undefined;

  return (
    <>
      {/* 26/10/2026 - Rà soát chuẩn phẳng Zero-shadow, viền 1px border-border-subtle, tông Teal #0E5E5E */}
      <Card id={FACE_SECTION_ID} className="border border-border-subtle bg-bg-surface rounded-radius-md shadow-none scroll-mt-20">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-radius-sm bg-accent-soft text-accent">
              <CameraIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-[15px] font-semibold text-text-primary">{t('hrm:faceEnroll.sectionTitle')}</CardTitle>
              <CardDescription className="text-[13px] text-text-secondary">{t('hrm:faceEnroll.sectionDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          {statusQuery.isLoading ? (
            <Spinner className="h-5 w-5 text-accent" />
          ) : statusQuery.isError || !data ? (
            <div className="flex items-center justify-between gap-2.5 rounded-radius-sm border border-error/20 bg-error-soft px-3 py-2.5 text-[13px] text-error">
              <span>{t('hrm:faceEnroll.loadError')}</span>
              <Button type="button" variant="secondary" size="sm" onClick={() => statusQuery.refetch()}>
                {t('common:queryState.retry')}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                {data.status === 'ACTIVE' && (
                  <div className="flex gap-3">
                    <FacePhotoBox
                      fetcher={data.hasPhoto ? () => fetchMyFacePhoto(false) : null}
                      reloadKey={`active-${data.enrolledAt}`}
                      alt={t('hrm:face.photoAlt')}
                      onOpen={setLargePhoto}
                    />
                    <div className="space-y-1 text-[13px]">
                      <p className="flex items-center gap-1.5 font-medium text-success">
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        {t('hrm:face.status.ACTIVE')}
                      </p>
                      <p className="text-text-secondary">
                        {t('hrm:face.activeInfo', {
                          source: t(`hrm:face.sources.${data.source ?? 'SELF_CAMERA'}`),
                          date: data.enrolledAt ? formatDateTime(data.enrolledAt) : '—',
                        })}
                      </p>
                    </div>
                  </div>
                )}
                {data.pending && (
                  <div className="flex gap-3">
                    <FacePhotoBox
                      fetcher={() => fetchMyFacePhoto(true)}
                      reloadKey={`pending-${data.pending.createdAt}`}
                      alt={t('hrm:face.pendingPhotoAlt')}
                      onOpen={setLargePhoto}
                    />
                    <div className="space-y-2 text-[13px]">
                      <p className="flex items-center gap-1.5 font-medium text-warning">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {t('hrm:faceEnroll.pendingFrom', { name: pendingActor, date: formatDate(data.pending.createdAt) })}
                      </p>
                      <p className="text-text-secondary">{t('hrm:faceEnroll.pendingNotUsed', { date: formatDate(data.pending.expiresAt) })}</p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button type="button" size="sm" onClick={() => setConsentIntent('confirm')}>
                          {t('hrm:faceEnroll.confirmPending')}
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setIsRejectOpen(true)}>
                          {t('hrm:faceEnroll.rejectPending')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {data.status === 'NONE' && <p className="text-[13px] text-text-secondary">{t('hrm:faceEnroll.noneNote')}</p>}
              {data.status === 'WITHDRAWN' && (
                <p className="text-[13px] text-text-secondary">
                  {t('hrm:faceEnroll.withdrawnNote', { date: data.consentAt ? formatDate(data.consentAt) : '—' })}
                </p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant={data.status === 'ACTIVE' ? 'secondary' : 'primary'}
                  onClick={() => setConsentIntent('camera')}
                  isLoading={enrollingSource === 'SELF_CAMERA'}
                  disabled={enrollingFromCard}
                >
                  <CameraIcon className="h-3.5 w-3.5 mr-1.5" />
                  {t(data.status === 'ACTIVE' ? 'hrm:faceEnroll.reEnrollButton' : 'hrm:faceEnroll.cameraButton')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConsentIntent('upload')}
                  isLoading={enrollingSource === 'SELF_UPLOAD'}
                  disabled={enrollingFromCard}
                >
                  <UploadIcon className="h-3.5 w-3.5 mr-1.5" />
                  {t('hrm:faceEnroll.uploadButton')}
                </Button>
                {(data.status === 'ACTIVE' || data.pending) && (
                  <Button type="button" variant="secondary" onClick={() => setIsWithdrawOpen(true)}>
                    <TrashIcon className="h-3.5 w-3.5 mr-1.5" />
                    {t('hrm:faceEnroll.withdrawButton')}
                  </Button>
                )}
              </div>
            </>
          )}

          <div className="flex items-start gap-2.5 rounded-radius-sm border border-[#1E5A8A]/20 bg-[#E4EEF5] px-3 py-2.5 text-[13px] leading-[20px] text-[#1E5A8A]">
            <AlertCircleIcon className="h-3.5 w-3.5 shrink-0 text-[#1E5A8A] mt-0.5" />
            <p className="font-normal">{t('hrm:faceEnroll.softWarningNote')}</p>
          </div>
        </CardContent>
      </Card>

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => handleFileChange(e, 'SELF_UPLOAD')} />
      {!webcam && (
        <input ref={captureInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => handleFileChange(e, 'SELF_CAMERA')} />
      )}

      <FaceConsentDialog
        open={consentIntent !== null}
        onClose={() => setConsentIntent(null)}
        onAgree={handleConsentAgree}
        isLoading={confirmPending.isPending}
      />

      <CheckInCamera
        open={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onConfirm={(photo) => enroll.mutate({ photo, source: 'SELF_CAMERA' }, { onSuccess: () => setIsCameraOpen(false) })}
        isSubmitting={enroll.isPending}
        mode="enroll"
      />

      <ConfirmDialog
        open={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        onConfirm={() => rejectPending.mutate(undefined, { onSuccess: () => setIsRejectOpen(false) })}
        title={t('hrm:faceEnroll.rejectConfirmTitle')}
        description={t('hrm:faceEnroll.rejectConfirmDescription')}
        danger
        isLoading={rejectPending.isPending}
      />

      <ConfirmDialog
        open={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        onConfirm={() => withdraw.mutate(undefined, { onSuccess: () => setIsWithdrawOpen(false) })}
        title={t('hrm:faceEnroll.deleteConfirmTitle')}
        description={t('hrm:faceEnroll.deleteConfirmDescription')}
        danger
        isLoading={withdraw.isPending}
      />

      <Modal open={Boolean(largePhoto)} onClose={() => setLargePhoto(null)} title={t('hrm:face.photoAlt')} size="lg">
        {largePhoto && <img src={largePhoto} alt={t('hrm:face.photoAlt')} className="mx-auto max-h-[70vh] rounded-radius-sm" />}
      </Modal>
    </>
  );
});
