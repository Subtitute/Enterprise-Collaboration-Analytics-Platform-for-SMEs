import { memo, useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, PasswordInput } from '@/components/ui/Input';
import { LockIcon } from '@/components/ui/Icons';
import { useToastStore } from '@/stores/toast.store';
import { useLogout } from '@/features/auth/hooks';
import { useChangeMyPassword } from '../hooks';

export const ProfileSecurityCard = memo(function ProfileSecurityCard() {
  const { t } = useTranslation();
  const toast = useToastStore((s) => s.push);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // 26/10/2026: goi API that (PATCH /users/me/password) thay cho setTimeout gia lap; doi xong thi dang
  // xuat (server da thu hoi moi phien dang nhap).
  const logout = useLogout();
  const changePassword = useChangeMyPassword(() => logout.mutate());

  // Xử lý đổi mật khẩu
  function handleUpdatePassword(e: FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      toast({
        variant: 'error',
        title: t('profile:page.toasts.missingCurrentPassword'),
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        variant: 'error',
        title: t('profile:page.toasts.passwordTooShort'),
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        variant: 'error',
        title: t('profile:page.toasts.passwordMismatch'),
      });
      return;
    }

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
      },
    );
  }

  return (
    <Card className="border border-border-subtle bg-bg-surface rounded-radius-md shadow-none">
      <CardHeader className="pb-4 border-b border-border-subtle">
        <div className="flex items-center gap-2.5">
          {/* Icon frame 32x32 accent-soft + icon 16px accent */}
          <div className="flex h-8 w-8 items-center justify-center rounded-radius-sm bg-accent-soft text-accent">
            <LockIcon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-[15px] font-semibold text-text-primary">
              {t('profile:page.sections.security')}
            </CardTitle>
            <CardDescription className="text-[13px] text-text-secondary">
              {t('profile:page.sections.securityDesc')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {/* Mật khẩu hiện tại */}
          <FormField label={t('profile:page.fields.currentPassword')} htmlFor="current-password" required>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('profile:page.fields.currentPasswordPlaceholder')}
            />
          </FormField>

          {/* Mật khẩu mới & Xác nhận */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('profile:page.fields.newPassword')} htmlFor="new-password" required>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('profile:page.fields.newPasswordPlaceholder')}
              />
            </FormField>

            <FormField label={t('profile:page.fields.confirmPassword')} htmlFor="confirm-password" required>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('profile:page.fields.confirmPasswordPlaceholder')}
              />
            </FormField>
          </div>

          {/* Nút cập nhật mật khẩu: Primary ink + icon lock 14px */}
          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" isLoading={changePassword.isPending}>
              <LockIcon className="h-3.5 w-3.5 mr-1.5" />
              {t('profile:page.buttons.updatePassword')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
});

