import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import { cropSquareAvatar, ImageNormalizeError } from '@/lib/image-normalize';
import { changeMyPassword, deleteAvatar, fetchUser, updateMyPhone, uploadAvatar } from './api';

export function useMyProfileQuery() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => fetchUser(userId as string),
    enabled: Boolean(userId),
  });
}

// 26/10/2026: lam moi moi noi hien ho so/avatar (Ho so, Topbar, danh sach nhan vien, danh ba).
function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'directory'] });
  };
}

export function useUpdateMyPhone() {
  const { t } = useTranslation();
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (phoneNumber: string | null) => updateMyPhone(phoneNumber),
    onSuccess: () => {
      invalidate();
      toast.success(t('profile:page.toasts.profileUpdated'));
    },
    onError: (error) => toast.error(t('profile:page.toasts.profileUpdateFailed'), extractErrorMessage(error)),
  });
}

/** `target` = uuid hoac 'me'; anh duoc cat vuong 512px JPEG phia trinh duyet truoc khi gui. */
export function useUploadAvatar() {
  const { t } = useTranslation();
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ target, file }: { target: string; file: Blob }) => uploadAvatar(target, await cropSquareAvatar(file)),
    onSuccess: () => {
      invalidate();
      toast.success(t('profile:page.toasts.avatarUpdated'));
    },
    onError: (error) =>
      toast.error(
        t('profile:page.toasts.avatarUpdateFailed'),
        error instanceof ImageNormalizeError ? t('errors:AVATAR_INVALID') : extractErrorMessage(error),
      ),
  });
}

export function useDeleteAvatar() {
  const { t } = useTranslation();
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (target: string) => deleteAvatar(target),
    onSuccess: () => {
      invalidate();
      toast.success(t('profile:page.toasts.avatarRemoved'));
    },
    onError: (error) => toast.error(t('profile:page.toasts.avatarUpdateFailed'), extractErrorMessage(error)),
  });
}

/**
 * 26/10/2026: PATCH /users/me/password - server thu hoi MOI refresh token (ke ca phien nay) nen sau khi
 * doi thanh cong: thong bao roi dang xuat de dang nhap lai bang mat khau moi.
 */
export function useChangeMyPassword(onDone: () => void) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => changeMyPassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success(t('profile:page.toasts.passwordSuccess'), t('profile:page.toasts.passwordReLogin'));
      onDone();
    },
    onError: (error) => toast.error(t('profile:page.toasts.passwordFailed'), extractErrorMessage(error)),
  });
}
