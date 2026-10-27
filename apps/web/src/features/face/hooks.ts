import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import type { FaceEnrollmentStatus } from '@/types';
import {
  confirmMyPendingFace,
  deleteUserFace,
  enrollMyFace,
  fetchFaceStatuses,
  fetchUserFaceStatus,
  getMyFaceStatus,
  rejectMyPendingFace,
  uploadUserFace,
  withdrawMyFace,
} from './api';

// 26/10/2026: hook kho anh nhan dien (Technical_Spec.md muc 27, Wireframe muc 16.3/16.5).

export function useMyFaceStatusQuery(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['face', 'me'], queryFn: getMyFaceStatus, enabled: options?.enabled });
}

export function useFaceStatusesQuery(userIds: string[]) {
  return useQuery({
    queryKey: ['face', 'statuses', userIds],
    queryFn: () => fetchFaceStatuses(userIds),
    enabled: userIds.length > 0,
  });
}

export function useUserFaceStatusQuery(userId: string | null) {
  return useQuery({
    queryKey: ['face', 'user', userId],
    queryFn: () => fetchUserFaceStatus(userId as string),
    enabled: Boolean(userId),
  });
}

/**
 * Anh nhan dien: tai qua proxy -> blob URL cuc bo, KHONG qua cache react-query (moi lan mo la 1 luot
 * xem duoc ghi nhat ky o server), thu hoi blob URL khi dong.
 */
export function useFacePhotoUrl(fetcher: (() => Promise<Blob>) | null, reloadKey: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!fetcher) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    setFailed(false);
    fetcher()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);
  return { url, failed };
}

function useFaceInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['face'] });
}

export function useEnrollMyFace() {
  const { t } = useTranslation();
  const invalidate = useFaceInvalidation();
  return useMutation({
    mutationFn: ({ photo, source }: { photo: Blob; source: 'SELF_CAMERA' | 'SELF_UPLOAD' }) => enrollMyFace(photo, source),
    onSuccess: (data: FaceEnrollmentStatus) => {
      invalidate();
      toast.success(t('hrm:faceEnroll.toasts.enrollSuccess'));
      if (data.warnings?.length) toast.info(data.warnings.map((w) => t(`errors:${w}`)).join(' · '));
    },
    onError: (error) => toast.error(t('hrm:faceEnroll.toasts.enrollError'), extractErrorMessage(error)),
  });
}

export function useConfirmMyPendingFace() {
  const { t } = useTranslation();
  const invalidate = useFaceInvalidation();
  return useMutation({
    mutationFn: confirmMyPendingFace,
    onSuccess: () => {
      invalidate();
      toast.success(t('hrm:faceEnroll.toasts.confirmSuccess'));
    },
    onError: (error) => toast.error(t('hrm:faceEnroll.toasts.actionError'), extractErrorMessage(error)),
  });
}

export function useRejectMyPendingFace() {
  const { t } = useTranslation();
  const invalidate = useFaceInvalidation();
  return useMutation({
    mutationFn: rejectMyPendingFace,
    onSuccess: () => {
      invalidate();
      toast.success(t('hrm:faceEnroll.toasts.rejectSuccess'));
    },
    onError: (error) => toast.error(t('hrm:faceEnroll.toasts.actionError'), extractErrorMessage(error)),
  });
}

export function useWithdrawMyFace() {
  const { t } = useTranslation();
  const invalidate = useFaceInvalidation();
  return useMutation({
    mutationFn: withdrawMyFace,
    onSuccess: () => {
      invalidate();
      toast.success(t('hrm:faceEnroll.toasts.deleteSuccess'));
    },
    onError: (error) => toast.error(t('hrm:faceEnroll.toasts.deleteError'), extractErrorMessage(error)),
  });
}

export function useUploadUserFace() {
  const { t } = useTranslation();
  const invalidate = useFaceInvalidation();
  return useMutation({
    mutationFn: ({ userId, photo }: { userId: string; photo: Blob }) => uploadUserFace(userId, photo, 'ADMIN'),
    onSuccess: () => {
      invalidate();
      toast.success(t('admin:facePanel.toasts.uploaded'));
    },
    onError: (error) => toast.error(t('admin:facePanel.toasts.uploadFailed'), extractErrorMessage(error)),
  });
}

export function useDeleteUserFace() {
  const { t } = useTranslation();
  const invalidate = useFaceInvalidation();
  return useMutation({
    mutationFn: (userId: string) => deleteUserFace(userId),
    onSuccess: () => {
      invalidate();
      toast.success(t('admin:facePanel.toasts.deleted'));
    },
    onError: (error) => toast.error(t('admin:facePanel.toasts.deleteFailed'), extractErrorMessage(error)),
  });
}
