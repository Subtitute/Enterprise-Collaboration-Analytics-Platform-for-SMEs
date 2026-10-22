import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useLogin } from './hooks';
import { containsVietnameseDiacritics } from '@/lib/utils';
import { FormField, Input, PasswordInput, Checkbox } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthShell } from './components/AuthShell';
import { QuickLoginWidget } from './components/QuickLoginWidget';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface DemoAccountItem {
  id: 'superAdmin' | 'admin' | 'manager' | 'employee';
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
    badgeClass: 'bg-[#E4EFEE] text-[#0E5E5E] border-[#0E5E5E]/20',
    email: 'admin@demo-sme.vn',
    password: 'Password123!',
  },
  {
    id: 'manager',
    roleNameKey: 'auth:loginPage.demoAccount.roles.manager',
    descKey: 'auth:loginPage.demoAccount.roles.managerDesc',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    // 17/09/2026: sua lai email demo Manager - hau to ngau nhien "+246317" tu ban seed cu khong
    // con ton tai (moi nhan vien duoc invite qua API voi 1 hau to ngau nhien rieng, sinh ra khac
    // nhau moi lan seed lai). "binh.tran+141603" la Truong phong Kinh doanh, da duoc thang chuc
    // Manager that su trong DB hien tai (xem fix-manager-role-and-customer-owners.js).
    // 13/10/2026: dong bo voi tai khoan Manager that su dang active trong DB hien tai (an.nguyen+246317).
    email: 'an.nguyen+246317@demo-sme.vn',
    password: 'Password123!',
  },
  {
    id: 'employee',
    roleNameKey: 'auth:loginPage.demoAccount.roles.employee',
    descKey: 'auth:loginPage.demoAccount.roles.employeeDesc',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    // 17/09/2026: tuong tu - "khoa.lam+861373" la nhan vien Kinh doanh dang thuc su phu trach
    // khach hang va duoc giao task/du an, phu hop de minh hoa tinh nang gioi han xem theo
    // "duoc giao" moi bo sung (Employee chi thay du an/khach hang cua chinh minh).
    // 13/10/2026: dong bo voi tai khoan Employee that su dang active trong DB hien tai (binh.tran+246317).
    email: 'binh.tran+246317@demo-sme.vn',
    password: 'Password123!',
  },
  // 16/09/2026: "Super Admin" (tinh nang moi) - khop dung gia tri mac dinh cua
  // SUPER_ADMIN_EMAIL/PASSWORD trong infra/.env.example (chi co tac dung khi tinh nang duoc bat -
  // xem bootstrap/super-admin-bootstrap.service.ts). Dang nhap thanh cong se dieu huong thang toi
  // /platform-admin (xem useLogin()), khac han 3 tai khoan con lai.
  {
    id: 'superAdmin',
    roleNameKey: 'auth:loginPage.demoAccount.roles.superAdmin',
    descKey: 'auth:loginPage.demoAccount.roles.superAdminDesc',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
    email: 'superadmin@ecap-platform.local',
    password: 'SuperAdmin123!',
  },
];

export function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const login = useLogin();

  const initialEmail = (location.state as { email?: string })?.email || '';
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errorKeys, setErrorKeys] = useState<{ email?: 'emailRequired' | 'emailInvalid'; password?: 'passwordRequired' | 'invalidCredentials' }>({});

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
    if (login.isPending) return;
    if (!validate()) return;
    login.mutate(
      { email: email.trim(), password },
      {
        onError: () => {
          // Theo §B.7: Error — sai thông tin: "Email hoặc mật khẩu không đúng" hiển thị ở field message của password
          setErrorKeys((prev) => ({ ...prev, password: 'invalidCredentials' }));
        },
      },
    );
  }

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
  const passwordError = errorKeys.password
    ? errorKeys.password === 'invalidCredentials'
      ? t('auth:loginPage.errors.invalidCredentials')
      : t(`auth:loginPage.errors.${errorKeys.password}`)
    : undefined;
  const passwordWarning =
    !passwordError && containsVietnameseDiacritics(password)
      ? t('common:password.diacriticsWarning')
      : undefined;

  return (
    <AuthShell
      extraWidget={
        <QuickLoginWidget
          accounts={DEMO_ACCOUNTS}
          onFillDemo={handleFillDemo}
          onBypassLogin={handleQuickLogin}
          isLoading={login.isPending}
        />
      }
    >
      <h2 className="font-sans text-[28px] leading-9 font-semibold text-text-primary mb-1.5">
        {t('auth:loginPage.title')}
      </h2>
      <p className="font-sans text-sm leading-[22px] text-text-secondary mb-8">
        {t('auth:loginPage.subtitle')}
      </p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col">
            {/* Field Email */}
            <div className="mb-4">
              <FormField label={t('auth:loginPage.emailLabel', 'Email')} htmlFor="email" error={emailError} required reserveMessageSpace>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('auth:loginPage.emailPlaceholder', 'ban@congty.com')}
                    value={email}
                    className="pl-9 pr-3"
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorKeys.email) setErrorKeys((prev) => ({ ...prev, email: undefined }));
                    }}
                  />
                </div>
              </FormField>
            </div>

            {/* Field Mật khẩu */}
            <div className="mb-1">
              <FormField
                label={t('auth:loginPage.passwordLabel')}
                htmlFor="password"
                error={passwordError}
                warning={passwordWarning}
                required
                reserveMessageSpace
              >
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  placeholder={t('auth:loginPage.passwordPlaceholder')}
                  value={password}
                  leftIcon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  }
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorKeys.password) setErrorKeys((prev) => ({ ...prev, password: undefined }));
                  }}
                />
              </FormField>
            </div>

            {/* Hàng tiện ích (Ghi nhớ đăng nhập + Quên mật khẩu) */}
            <div className="flex items-center justify-between mb-5 mt-1">
              <label htmlFor="rememberMe" className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="text-[13px] leading-5 text-text-secondary">
                  {t('auth:loginPage.rememberMe')}
                </span>
              </label>
              <Link
                to="/forgot-password"
                className="text-[13px] leading-5 font-normal text-accent hover:text-accent-hover hover:underline transition-colors"
              >
                {t('auth:loginPage.forgotPasswordLink')}
              </Link>
            </div>

            {/* Nút Đăng nhập */}
            <Button
              type="submit"
              size="lg"
              variant="primary"
              className="w-full h-11 text-sm font-medium bg-[#1C1B1A] text-[#F7F6F3] hover:bg-[#2E2C29] active:bg-[#141312]"
              isLoading={login.isPending}
            >
              {login.isPending ? t('common:loading') : t('auth:loginPage.submit')}
            </Button>
          </form>

          {/* Khối đăng ký tổ chức mới */}
          <div className="mt-6 text-center text-[13px] leading-5 text-text-secondary">
            <span>{t('auth:loginPage.noOrganization')} </span>
            <Link
              to="/register"
              className="font-medium text-accent hover:text-accent-hover hover:underline transition-colors ml-1"
            >
              {t('auth:loginPage.registerLink')}
            </Link>
          </div>
    </AuthShell>
  );
}
