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

interface DemoAccountItem {
  id: 'admin' | 'manager' | 'employee';
  roleNameKey: string;
  descKey: string;
  badgeClass: string;
  email: string;
  password: string;
}

const DEMO_ACCOUNTS: DemoAccountItem[] = [
  {
    id: 'admin',
    roleNameKey: 'auth:loginPage.demoAccount.roles.admin',
    descKey: 'auth:loginPage.demoAccount.roles.adminDesc',
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',
    email: 'admin@demo-sme.vn',
    password: 'Password123!',
  },
  {
    id: 'manager',
    roleNameKey: 'auth:loginPage.demoAccount.roles.manager',
    descKey: 'auth:loginPage.demoAccount.roles.managerDesc',
    badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    email: 'an.nguyen+246317@demo-sme.vn',
    password: 'Password123!',
  },
  {
    id: 'employee',
    roleNameKey: 'auth:loginPage.demoAccount.roles.employee',
    descKey: 'auth:loginPage.demoAccount.roles.employeeDesc',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    email: 'binh.tran+246317@demo-sme.vn',
    password: 'Password123!',
  },
];

export function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const login = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorKeys, setErrorKeys] = useState<{ email?: 'emailRequired' | 'emailInvalid'; password?: 'passwordRequired' }>({});
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);
  const [activeRoleIndex, setActiveRoleIndex] = useState<number>(0);

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
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Bỏ qua lỗi sao chép
    }
  };

  const selectedDemo = DEMO_ACCOUNTS[activeRoleIndex] || DEMO_ACCOUNTS[0];

  const handleFillDemo = (acc: DemoAccountItem) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setErrorKeys({});
  };

  const handleQuickLogin = (acc: DemoAccountItem) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setErrorKeys({});
    login.mutate({ email: acc.email, password: acc.password });
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
          <div className="-mt-2 text-right">
            <Link
              to="/forgot-password"
              className="inline-block text-xs font-medium text-primary-600 transition-all duration-200 hover:text-primary-700 hover:underline"
            >
              {t('auth:loginPage.forgotPasswordLink')}
            </Link>
          </div>
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

      {/* Widget trực quan trải nghiệm Đăng nhập nhanh 3 vai trò (Org Admin / Manager / Employee) */}
      <div className="fixed bottom-6 right-6 z-30 w-84 max-w-[calc(100vw-2rem)] animate-slide-up rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xl shadow-slate-200/80 backdrop-blur-md transition-all duration-200 hover:shadow-2xl">
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-900 truncate">{t('auth:loginPage.demoAccount.title')}</span>
          </div>
          <button
            type="button"
            onClick={() => handleFillDemo(selectedDemo)}
            className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 hover:underline cursor-pointer shrink-0"
          >
            {t('auth:loginPage.demoAccount.autofill')}
          </button>
        </div>

        {/* Tab chuyển đổi 3 vai trò */}
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 mb-2.5">
          {DEMO_ACCOUNTS.map((acc, index) => {
            const isActive = activeRoleIndex === index;
            const shortLabel = index === 0 ? 'Admin' : index === 1 ? 'Manager' : 'Employee';
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setActiveRoleIndex(index)}
                className={`py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>

        {/* Thông tin chi tiết của vai trò đang chọn */}
        <div className="space-y-2 text-xs">
          <div className="rounded-lg bg-slate-50/80 p-2 border border-slate-100 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-800 text-[11px] truncate">{t(selectedDemo.roleNameKey)}</span>
              <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold border ${selectedDemo.badgeClass}`}>
                {selectedDemo.id.toUpperCase()}
              </span>
            </div>
            <p className="text-[10.5px] text-slate-500 leading-tight">
              {t(selectedDemo.descKey)}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50/80 px-2.5 py-1.5 border border-slate-100">
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] text-slate-400 font-medium">Email:</span>
              <span className="block truncate font-mono text-slate-800 text-[11px]">{selectedDemo.email}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(selectedDemo.email, 'email')}
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
              <span className="block truncate font-mono text-slate-800 text-[11px]">{selectedDemo.password}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(selectedDemo.password, 'password')}
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

          {/* Nút Đăng nhập 1-Click trực tiếp */}
          <button
            type="button"
            onClick={() => handleQuickLogin(selectedDemo)}
            disabled={login.isPending}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {login.isPending ? '...' : (
              <>
                <span>{t('auth:loginPage.demoAccount.quickLogin')}</span>
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
