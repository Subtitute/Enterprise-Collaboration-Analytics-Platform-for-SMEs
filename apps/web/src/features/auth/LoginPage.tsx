import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useLogin } from './hooks';
import { AuthLayout } from './components/AuthLayout';
import { FormField, Input, PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CopyIcon, CheckIcon } from '@/components/ui/Icons';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEMO_CREDENTIALS = {
  email: 'admin@demo-sme.vn',
  password: 'Password123!',
};

export function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const login = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorKeys, setErrorKeys] = useState<{ email?: 'emailRequired' | 'emailInvalid'; password?: 'passwordRequired' }>({});
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);

  const from = (location.state as { from?: { pathname: string; search?: string } })?.from;
  const redirectTarget = from ? `${from.pathname}${from.search || ''}` : '/dashboard';

  if (accessToken) return <Navigate to={redirectTarget} replace />;

  function validate() {
    const next: typeof errorKeys = {};
    if (!email.trim()) next.email = 'emailRequired';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'emailInvalid';
    if (!password) next.password = 'passwordRequired';
    setErrorKeys(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    login.mutate({ email: email.trim(), password });
  }

  const handleCopy = async (text: string, field: 'email' | 'password') => {
    // 26/08/2026: Fix 7 - await navigator.clipboard.writeText() va chi hien trang thai "đã sao
    // chép" khi THANH CONG - truoc ban sua nay goi writeText() (tra ve mot Promise) nhung KHONG
    // doi/bat loi, roi hien icon check + trang thai "đã sao chép" NGAY LAP TUC bat ke thanh cong
    // hay that bai (vd trinh duyet tu choi quyen Clipboard, trang khong chay tren context HTTPS,
    // hoac API khong duoc ho tro) - nguoi dung thay dau "đã sao chép" GIA trong khi thuc te khong
    // co gi duoc sao vao clipboard. Neu that bai thi im lang bo qua (day chi la tien ich phu cho
    // tai khoan demo, khong phai luong nghiep vu chinh nen khong can toast loi rieng).
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Sao chep that bai - khong hien trang thai "đã sao chép" gia.
    }
  };

  const handleFillDemo = () => {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
    setErrorKeys({});
  };

  const emailError = errorKeys.email ? t(`auth:loginPage.errors.${errorKeys.email}`) : undefined;
  const passwordError = errorKeys.password ? t(`auth:loginPage.errors.${errorKeys.password}`) : undefined;

  return (
    <>
      <AuthLayout title={t('auth:loginPage.title')} subtitle={t('auth:loginPage.subtitle')}>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField label={t('auth:loginPage.emailLabel')} htmlFor="email" error={emailError} required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('auth:loginPage.emailPlaceholder')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorKeys.email) setErrorKeys((prev) => ({ ...prev, email: undefined }));
              }}
            />
          </FormField>
          <FormField label={t('auth:loginPage.passwordLabel')} htmlFor="password" error={passwordError} required>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorKeys.password) setErrorKeys((prev) => ({ ...prev, password: undefined }));
              }}
            />
          </FormField>
          <Button type="submit" className="w-full" isLoading={login.isPending}>
            {t('auth:loginPage.submit')}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          {t('auth:loginPage.noOrganization')}{' '}
          <Link
            to="/register"
            className="inline-block font-medium text-primary-600 transition-all duration-200 hover:text-primary-700 hover:-translate-y-[0.5px] active:translate-y-0 hover:underline"
          >
            {t('auth:loginPage.registerLink')}
          </Link>
        </p>
      </AuthLayout>

      {/* Thẻ hiển thị tài khoản mẫu ở góc dưới bên phải */}
      <div className="fixed bottom-6 right-6 z-30 max-w-xs animate-slide-up rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xl shadow-slate-200/80 backdrop-blur-md transition-all duration-200 hover:shadow-2xl">
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-900">{t('auth:loginPage.demoAccount.title')}</span>
          </div>
          <button
            type="button"
            onClick={handleFillDemo}
            className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 hover:underline cursor-pointer"
          >
            {t('auth:loginPage.demoAccount.autofill')}
          </button>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50/80 px-2.5 py-1.5 border border-slate-100">
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] text-slate-400 font-medium">Email:</span>
              <span className="block truncate font-mono text-slate-800">{DEMO_CREDENTIALS.email}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(DEMO_CREDENTIALS.email, 'email')}
              title={t('auth:loginPage.demoAccount.copyEmailTitle')}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
            >
              {copiedField === 'email' ? (
                <CheckIcon className="h-3.5 w-3.5 text-emerald-600 animate-fade-in" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50/80 px-2.5 py-1.5 border border-slate-100">
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] text-slate-400 font-medium">{t('auth:loginPage.demoAccount.passwordLabel')}</span>
              <span className="block truncate font-mono text-slate-800">{DEMO_CREDENTIALS.password}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(DEMO_CREDENTIALS.password, 'password')}
              title={t('auth:loginPage.demoAccount.copyPasswordTitle')}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
            >
              {copiedField === 'password' ? (
                <CheckIcon className="h-3.5 w-3.5 text-emerald-600 animate-fade-in" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
