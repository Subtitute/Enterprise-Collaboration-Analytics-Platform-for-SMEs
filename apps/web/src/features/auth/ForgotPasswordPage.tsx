import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useForgotPassword } from './hooks';
import { AuthLayout } from './components/AuthLayout';
import { FormField, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MailIcon } from '@/components/ui/Icons';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 15/09/2026: "Quen mat khau" (phan hoi GVHD, muc 4) - form nay CHI nhan email va goi
 * useForgotPassword(). Backend luon tra ve thanh cong chung chung du email co ton tai hay khong
 * (chong do email, xem AuthService.forgotPassword()) nen sau khi submit thanh cong, trang LUON
 * chuyen sang man hinh xac nhan "da gui" (submitted) - khong bao gio bao "khong tim thay email"
 * hay bat ky tin hieu nao khac cho phep phan biet 2 truong hop do.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const forgotPassword = useForgotPassword();

  const [email, setEmail] = useState('');
  const [errorKey, setErrorKey] = useState<'emailRequired' | 'emailInvalid' | undefined>();
  const [submitted, setSubmitted] = useState(false);

  if (accessToken) return <Navigate to="/dashboard" replace />;

  function validate() {
    if (!email.trim()) {
      setErrorKey('emailRequired');
      return false;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setErrorKey('emailInvalid');
      return false;
    }
    setErrorKey(undefined);
    return true;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    forgotPassword.mutate({ email: email.trim() }, { onSuccess: () => setSubmitted(true) });
  }

  const emailError = errorKey ? t(`auth:forgotPasswordPage.errors.${errorKey}`) : undefined;

  if (submitted) {
    return (
      <AuthLayout title={t('auth:forgotPasswordPage.title')} subtitle={t('auth:forgotPasswordPage.subtitle')}>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <MailIcon className="h-6 w-6" />
          </div>
          <p className="text-sm text-slate-600">{t('auth:forgotPasswordPage.submittedMessage', { email: email.trim() })}</p>
          <Link
            to="/login"
            className="mt-2 inline-block font-medium text-primary-600 transition-all duration-200 hover:text-primary-700 hover:-translate-y-[0.5px] active:translate-y-0 hover:underline"
          >
            {t('auth:forgotPasswordPage.backToLogin')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth:forgotPasswordPage.title')} subtitle={t('auth:forgotPasswordPage.subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('auth:forgotPasswordPage.emailLabel')} htmlFor="email" error={emailError} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('auth:forgotPasswordPage.emailPlaceholder')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errorKey) setErrorKey(undefined);
            }}
          />
        </FormField>
        <Button type="submit" className="w-full" isLoading={forgotPassword.isPending}>
          {t('auth:forgotPasswordPage.submit')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link
          to="/login"
          className="inline-block font-medium text-primary-600 transition-all duration-200 hover:text-primary-700 hover:-translate-y-[0.5px] active:translate-y-0 hover:underline"
        >
          {t('auth:forgotPasswordPage.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  );
}
