import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { CheckCircleIcon, ClockIcon, InfoIcon, TrashIcon, UploadIcon, XIcon } from '@/components/ui/Icons';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { deleteUserPendingFace, fetchUserFacePhoto } from '../api';
import { useDeleteUserFace, useUserFaceStatusQuery } from '../hooks';
import { FacePhotoBox } from './FacePhotoBox';
import { FaceUploadDialog } from './FaceUploadDialog';

/**
 * 26/10/2026: panel "Anh nhan dien cham cong" trong Ho so nhan vien (Wireframe muc 16.3) - 4 trang
 * thai: (a) dang dung, (b) cho nhan vien xac nhan, (c) chua dang ky, (d) nhan vien da tu choi/rut
 * dong y (khong tai ho duoc). Anh chi tai khi mo panel, qua proxy (server ghi nhat ky moi luot xem).
 */
export function FaceReferencePanel({ userId, userName }: { userId: string; userName: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const statusQuery = useUserFaceStatusQuery(userId);
  const deleteFace = useDeleteUserFace();
  const { map: userNameMap } = useUserNameMap();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'cancelPending' | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [largePhoto, setLargePhoto] = useState<string | null>(null);
  const data = statusQuery.data;

  async function handleConfirm() {
    if (confirm === 'delete') {
      deleteFace.mutate(userId, { onSuccess: () => setConfirm(null) });
      return;
    }
    setCancelling(true);
    try {
      await deleteUserPendingFace(userId);
      await queryClient.invalidateQueries({ queryKey: ['face'] });
      setConfirm(null);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-[14px] font-semibold text-text-primary">{t('admin:facePanel.title')}</h3>
      {statusQuery.isLoading ? (
        <Spinner className="h-5 w-5 text-accent" />
      ) : statusQuery.isError || !data ? (
        <p className="text-[13px] text-error">{t('hrm:faceEnroll.loadError')}</p>
      ) : (
        <div className="space-y-3 rounded-radius-md border border-border-subtle p-3">
          {data.status === 'ACTIVE' && (
            <div className="flex gap-3">
              <FacePhotoBox
                fetcher={data.hasPhoto ? () => fetchUserFacePhoto(userId, false) : null}
                reloadKey={`${userId}-active-${data.enrolledAt}`}
                alt={t('hrm:face.photoAlt')}
                onOpen={setLargePhoto}
              />
              <div className="space-y-1 text-[13px]">
                <p className="flex items-center gap-1.5 font-medium text-success">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> {t('admin:facePanel.activeTitle')}
                </p>
                <p className="text-text-secondary">{t('admin:facePanel.source', { source: t(`hrm:face.sources.${data.source ?? 'SELF_CAMERA'}`) })}</p>
                <p className="text-text-secondary">{t('admin:facePanel.updatedAt', { date: data.enrolledAt ? formatDateTime(data.enrolledAt) : '—' })}</p>
              </div>
            </div>
          )}

          {data.pending && (
            <div className="flex gap-3">
              <FacePhotoBox
                fetcher={() => fetchUserFacePhoto(userId, true)}
                reloadKey={`${userId}-pending-${data.pending.createdAt}`}
                alt={t('hrm:face.pendingPhotoAlt')}
                onOpen={setLargePhoto}
              />
              <div className="space-y-1 text-[13px]">
                <p className="flex items-center gap-1.5 font-medium text-warning">
                  <ClockIcon className="h-3.5 w-3.5" /> {t('hrm:face.status.PENDING_CONSENT')}
                </p>
                <p className="text-text-secondary">{t('admin:facePanel.source', { source: t(`hrm:face.sources.${data.pending.source}`) })}</p>
                <p className="text-text-secondary">{t('admin:facePanel.by', { name: userNameMap[data.pending.actorId] ?? t('hrm:face.unknownActor') })}</p>
                <p className="text-text-secondary">{t('admin:facePanel.expiresAt', { date: formatDate(data.pending.expiresAt) })}</p>
                <p className="flex items-start gap-1.5 text-[12px] text-info">
                  <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('admin:facePanel.pendingNotUsed')}
                </p>
              </div>
            </div>
          )}

          {data.status === 'NONE' && (
            <div className="space-y-1 text-[13px]">
              <p className="flex items-center gap-1.5 text-text-secondary">
                <XIcon className="h-3.5 w-3.5" /> {t('admin:facePanel.noneTitle')}
              </p>
              <p className="flex items-start gap-1.5 text-[12px] text-info">
                <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('admin:facePanel.noneNote')}
              </p>
            </div>
          )}

          {data.status === 'WITHDRAWN' && (
            <div className="space-y-1 text-[13px] text-error">
              <p className="font-medium">{t('admin:facePanel.withdrawnTitle', { date: data.consentAt ? formatDate(data.consentAt) : '—' })}</p>
              <p className="text-text-secondary">{t('admin:facePanel.withdrawnNote')}</p>
            </div>
          )}

          {data.status !== 'WITHDRAWN' && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="button" size="sm" variant={data.status === 'NONE' ? 'primary' : 'secondary'} onClick={() => setIsUploadOpen(true)}>
                <UploadIcon className="mr-1.5 h-3.5 w-3.5" />
                {t(data.status === 'NONE' ? 'admin:facePanel.upload' : data.pending ? 'admin:facePanel.uploadOther' : 'admin:facePanel.uploadReplace')}
              </Button>
              {data.pending && (
                <Button type="button" size="sm" variant="secondary" onClick={() => setConfirm('cancelPending')}>
                  {t('admin:facePanel.cancelPending')}
                </Button>
              )}
              {data.status === 'ACTIVE' && (
                <Button type="button" size="sm" variant="secondary" onClick={() => setConfirm('delete')}>
                  <TrashIcon className="mr-1.5 h-3.5 w-3.5" />
                  {t('admin:facePanel.delete')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <FaceUploadDialog open={isUploadOpen} onClose={() => setIsUploadOpen(false)} userId={userId} userName={userName} />

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        title={t(confirm === 'delete' ? 'admin:facePanel.deleteConfirmTitle' : 'admin:facePanel.cancelPendingConfirmTitle')}
        description={t(confirm === 'delete' ? 'admin:facePanel.deleteConfirmDescription' : 'admin:facePanel.cancelPendingConfirmDescription')}
        danger
        isLoading={deleteFace.isPending || cancelling}
      />

      <Modal open={Boolean(largePhoto)} onClose={() => setLargePhoto(null)} title={t('hrm:face.photoAlt')} size="lg">
        {largePhoto && <img src={largePhoto} alt={t('hrm:face.photoAlt')} className="mx-auto max-h-[70vh] rounded-radius-sm" />}
      </Modal>
    </section>
  );
}
