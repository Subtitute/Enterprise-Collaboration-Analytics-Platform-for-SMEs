import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useResetPassword } from './hooks';
import { AuthLayout } from './components/AuthLayout';
import { FormField, PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

/**
 * 15/09/2026: "Quen mat khau" (phan hoi GVHD, muc 4) - doc token tu query string (?token=...,
 * dung link duoc gui qua email boi EmailService.sendPasswordResetEmail()). Backend tra ve 1 ma
 * loi CHUNG DUY NHAT (PASSWORD_RESET_TOKEN_INVALID) cho ca token sai/het han/da dung roi (xem
 * chu thich ERROR_CODES tuong ung) nen trang nay cung KHONG co gang phan biet 3 truong hop do -
 * chi hien 1 thong bao loi chung qua toast (useResetPassword -> extractErrorMessage).
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const resetPassword = useResetPassword();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorKeys, setErrorKeys] = useState<{
    newPassword?: 'passwordRequired' | 'passwordTooShort';
    confirmPassword?: 'confirmPasswordMismatch';
  }>({});

  if (accessToken) return <Navigate to="/dashboard" replace />;

  // Thieu token (vd nguoi dung tu go thang URL /reset-password, khong qua link trong email) -
  // khong co gi de submit, huong dan xin link moi thay vi hien 1 form chac chan se loi luc gui.
  if (!token) {
    return (
      <AuthLayout title={t('auth:resetPasswordPage.title')} subtitle={t('auth:resetPasswordPage.subtitle')}>
        <p className="text-center text-sm text-slate-600">{t('auth:resetPasswordPage.missingToken')}</p>
        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="font-medium text-primary-600 hover:text-primary-700 hover:underline">
            {t('auth:resetPasswordPage.requestNewLink')}
          </Link>
        </p>
      </AuthLayout>
    );
  }

  function validate() {
    const next: typeof errorKeys = {};
    if (!newPassword) next.newPassword = 'passwordRequired';
    else if (newPassword.length < 8) next.newPassword = 'passwordTooShort';
    if (confirmPassword !== newPassword) next.confirmPassword = 'confirmPasswordMismatch';
    setErrorKeys(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    resetPassword.mutate({ token, newPassword });
  }

  const newPasswordError = errorKeys.newPassword ? t(`auth:resetPasswordPage.errors.${errorKeys.newPassword}`) : undefined;
  const confirmPasswordError = errorKeys.confirmPassword
    ? t(`auth:resetPasswordPage.errors.${errorKeys.confirmPassword}`)
    : undefined;

  return (
    <AuthLayout title={t('auth:resetPasswordPage.title')} subtitle={t('auth:resetPasswordPage.subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('auth:resetPasswordPage.newPasswordLabel')} htmlFor="newPassword" error={newPasswordError} required>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            placeholder={t('auth:resetPasswordPage.newPasswordPlaceholder')}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (errorKeys.newPassword) setErrorKeys((prev) => ({ ...prev, newPassword: undefined }));
            }}
          />
        </FormField>
        <FormField
          label={t('auth:resetPasswordPage.confirmPasswordLabel')}
          htmlFor="confirmPassword"
          error={confirmPasswordError}
          required
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder={t('auth:resetPasswordPage.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errorKeys.confirmPassword) setErrorKeys((prev) => ({ ...prev, confirmPassword: undefined }));
            }}
          />
        </FormField>
        <Button type="submit" className="w-full" isLoading={resetPassword.isPending}>
          {t('auth:resetPasswordPage.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
