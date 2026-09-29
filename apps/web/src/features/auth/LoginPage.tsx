import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useLogin } from './hooks';
import { FormField, Input, PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  CopyIcon,
  CheckIcon,
  ChevronDownIcon,
  MailIcon,
  LockIcon,
  InfoIcon,
  BrandLogoIcon,
} from '@/components/ui/Icons';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

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
    badgeClass: 'bg-[#EFF6FF] text-[#1E3A8A] border-[#1E3A8A]/30',
    email: 'admin@demo-sme.vn',
    password: 'Password123!',
  },
  {
    id: 'manager',
    roleNameKey: 'auth:loginPage.demoAccount.roles.manager',
    descKey: 'auth:loginPage.demoAccount.roles.managerDesc',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorKeys, setErrorKeys] = useState<{ email?: 'emailRequired' | 'emailInvalid'; password?: 'passwordRequired' }>({});
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);
  const [activeRoleIndex, setActiveRoleIndex] = useState<number>(0);
  const [isDemoOpen, setIsDemoOpen] = useState(false);

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
    <div className="flex min-h-screen w-full flex-col lg:flex-row antialiased select-text">
      {/* CỘT TRÁI: Chiếm 55-60% chiều rộng màn hình, nền Navy #1E3A8A đậm */}
      <div className="relative hidden w-full lg:flex lg:w-[58%] flex-col justify-between overflow-hidden bg-[#1E3A8A] p-10 xl:p-14 text-white">
        {/* Họa tiết hình học mờ: đường chéo mảnh, chấm tròn nhỏ rải rác, opacity ~8% */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.4) 1.5px, transparent 0),
              linear-gradient(45deg, rgba(255, 255, 255, 0.08) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.08) 75%, transparent 75%, transparent)
            `,
            backgroundSize: '40px 40px, 80px 80px',
          }}
        />

        {/* Vệt sáng nhẹ góc chéo để tạo chiều sâu tự nhiên */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-[#10B981]/10 blur-3xl" />

        {/* TRÊN CÙNG: Logo ECAP font Lora trắng */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-md ring-1 ring-white/20 shadow-md">
            <BrandLogoIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="font-heading text-2xl font-bold tracking-wider text-white">
              ECAP
            </span>
            <span className="ml-2 rounded bg-white/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold tracking-wider text-white/90">
              for SMEs
            </span>
          </div>
        </div>

        {/* Ở GIỮA: Câu tagline lớn font Lora trắng, size 28-32px */}
        <div className="relative z-10 max-w-xl my-auto py-12">
          <h1 className="font-heading text-3xl xl:text-[34px] font-semibold leading-snug text-white">
            {t('auth:loginPage.hero.tagline')}
          </h1>
          <p className="mt-4 font-sans text-sm xl:text-base leading-relaxed text-white/80 max-w-lg">
            {t('auth:loginPage.hero.description')}
          </p>

          {/* 3 đặc trưng nhận diện nhanh */}
          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/15 pt-6 text-white/85">
            <div>
              <p className="font-sans text-lg font-bold text-white">100%</p>
              <p className="font-sans text-xs text-white/70 mt-0.5">{t('auth:loginPage.hero.statRealtime')}</p>
            </div>
            <div>
              <p className="font-sans text-lg font-bold text-white">Microservices</p>
              <p className="font-sans text-xs text-white/70 mt-0.5">{t('auth:loginPage.hero.statMicroservices')}</p>
            </div>
            <div>
              <p className="font-sans text-lg font-bold text-white">SME-Ready</p>
              <p className="font-sans text-xs text-white/70 mt-0.5">{t('auth:loginPage.hero.statSmeReady')}</p>
            </div>
          </div>
        </div>

        {/* DƯỚI CÙNG: Dòng copyright nhỏ font Lora/Roboto trắng mờ (opacity 60%) */}
        <div className="relative z-10 flex items-center justify-between font-sans text-xs text-white/60">
          <span>&copy; 2026 ECAP for SMEs &middot; v0.1.0</span>
          <span>{t('auth:loginPage.hero.securityStandard')}</span>
        </div>
      </div>

      {/* CỘT PHẢI: Chiếm 40-45% chiều rộng, nền trắng #FAFAF9 */}
      <div className="relative flex flex-1 flex-col justify-between bg-[#FAFAF9] px-6 py-8 sm:px-12 md:px-16 lg:px-[60px] xl:px-20 min-h-screen">
        {/* HÀNG TRÊN CÙNG: Thông báo thử nghiệm (bên trái) + Nút chọn ngôn ngữ (bên phải) */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 border border-amber-200/80 text-amber-800">
            <InfoIcon className="h-3.5 w-3.5 text-[#F59E0B] shrink-0" />
            <span className="font-sans text-[11px] font-medium text-[#F59E0B]">
              {t('auth:loginPage.pilotNotice')}
            </span>
          </div>

          <div className="shrink-0">
            <LanguageSwitcher />
          </div>
        </div>

        {/* KHU VỰC GIỮA: Form đăng nhập căn giữa theo chiều dọc */}
        <div className="my-auto w-full max-w-md mx-auto py-8">
          {/* Header hiển thị logo trên mobile khi cột trái bị ẩn */}
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A8A] text-white shadow-xs">
              <BrandLogoIcon className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading text-xl font-bold tracking-wider text-[#1E3A8A]">
              ECAP
            </span>
          </div>

          {/* Tiêu đề & Dòng phụ */}
          <div className="mb-6">
            <h2 className="font-heading text-[28px] font-semibold text-[#1E3A8A] tracking-tight">
              {t('auth:loginPage.title')}
            </h2>
            <p className="mt-1.5 font-sans text-sm text-[#6B7280]">
              {t('auth:loginPage.welcomeBack')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Input Email với icon Mail */}
            <FormField label={t('auth:loginPage.emailLabel')} htmlFor="email" error={emailError} required>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <MailIcon className="h-4 w-4" />
                </div>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('auth:loginPage.emailPlaceholder')}
                  value={email}
                  className="pl-9 h-11 border-[#E5E7EB] focus:border-[#1E3A8A] focus:ring-[#1E3A8A]"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorKeys.email) setErrorKeys((prev) => ({ ...prev, email: undefined }));
                  }}
                />
              </div>
            </FormField>

            {/* Input Mật khẩu với icon Lock */}
            <FormField label={t('auth:loginPage.passwordLabel')} htmlFor="password" error={passwordError} required>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 z-10">
                  <LockIcon className="h-4 w-4" />
                </div>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  className="pl-9 h-11 border-[#E5E7EB] focus:border-[#1E3A8A] focus:ring-[#1E3A8A]"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorKeys.password) setErrorKeys((prev) => ({ ...prev, password: undefined }));
                  }}
                />
              </div>
            </FormField>

            {/* Link Quên mật khẩu: màu Navy #1E3A8A đồng bộ */}
            <div className="-mt-1 flex justify-end">
              <Link
                to="/forgot-password"
                className="font-sans text-xs font-bold text-[#1E3A8A] transition-colors duration-150 hover:underline hover:text-[#1E40AF]"
              >
                {t('auth:loginPage.forgotPasswordLink')}
              </Link>
            </div>

            {/* Nút Đăng nhập: nền #1E3A8A, chữ trắng, bo góc 8px, cao 44px, hover #1E40AF */}
            <Button
              type="submit"
              className="w-full h-[44px] rounded-[8px] bg-[#1E3A8A] hover:bg-[#1E40AF] text-white font-sans text-sm font-semibold transition-colors duration-200 shadow-xs cursor-pointer active:scale-[0.98]"
              isLoading={login.isPending}
            >
              {t('auth:loginPage.submit')}
            </Button>
          </form>

          {/* Link Đăng ký tổ chức mới: màu Navy #1E3A8A đồng bộ */}
          <p className="mt-6 text-center font-sans text-sm text-[#6B7280]">
            {t('auth:loginPage.noOrganization')}{' '}
            <Link
              to="/register"
              className="font-bold text-[#1E3A8A] transition-colors duration-150 hover:underline hover:text-[#1E40AF]"
            >
              {t('auth:loginPage.registerLink')}
            </Link>
          </p>
        </div>

        {/* HÀNG DƯỚI CÙNG: Dòng hỗ trợ người dùng */}
        <div className="pt-4 border-t border-slate-200/60 text-center font-sans text-xs text-[#6B7280]">
          <span>{t('auth:loginPage.supportContact')} <a href="mailto:support@ecap.vn" className="text-[#1E3A8A] font-medium hover:underline">support@ecap.vn</a></span>
        </div>
      </div>

      {/* 3. PANEL TÀI KHOẢN TRẢI NGHIỆM & DEMO (Thu gọn thành nút nhỏ góc dưới bên phải) */}
      <div className="fixed bottom-4 right-4 z-40 select-none">
        {!isDemoOpen ? (
          <button
            type="button"
            onClick={() => setIsDemoOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-[#1E3A8A]/30 bg-white/95 px-3 py-1.5 font-sans text-xs font-semibold text-[#1E3A8A] shadow-md backdrop-blur transition-all duration-150 hover:bg-[#EFF6FF] hover:border-[#1E3A8A] active:scale-95 cursor-pointer"
            title={t('auth:loginPage.demoToggleTitle')}
          >
            <span className="flex h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            <span>Demo</span>
            <ChevronDownIcon className="h-3.5 w-3.5 -rotate-90 text-[#1E3A8A]" />
          </button>
        ) : (
          <div className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="flex h-2 w-2 rounded-full bg-[#10B981]" />
                <span className="text-xs font-bold text-slate-900">
                  {t('auth:loginPage.demoAccount.title')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleFillDemo(selectedDemo)}
                  className="text-[11px] font-semibold text-[#10B981] hover:underline cursor-pointer"
                >
                  {t('auth:loginPage.demoAccount.autofill')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDemoOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded text-xs cursor-pointer"
                  title={t('auth:loginPage.closePanelTitle')}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tab chuyển đổi 4 vai trò */}
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 mb-2.5">
              {DEMO_ACCOUNTS.map((acc, index) => {
                const isActive = activeRoleIndex === index;
                const shortLabel =
                  acc.id === 'admin' ? 'Admin' : acc.id === 'manager' ? 'Manager' : acc.id === 'employee' ? 'Employee' : 'Super';
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setActiveRoleIndex(index)}
                    className={`py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#1E3A8A] shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Thông tin chi tiết */}
            <div className="space-y-2 text-xs">
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 text-[11px] truncate">{t(selectedDemo.roleNameKey)}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold border ${selectedDemo.badgeClass}`}>
                    {selectedDemo.id === 'superAdmin' ? 'SUPER ADMIN' : selectedDemo.id.toUpperCase()}
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  {t(selectedDemo.descKey)}
                </p>
              </div>

              {/* Email */}
              <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 border border-slate-100">
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] text-slate-400 font-medium">Email:</span>
                  <span className="block truncate font-mono text-slate-800 text-[11px]">{selectedDemo.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedDemo.email, 'email')}
                  title={t('auth:loginPage.demoAccount.copyEmailTitle')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {copiedField === 'email' ? (
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-600 animate-fade-in" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {/* Password */}
              <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 border border-slate-100">
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] text-slate-400 font-medium">{t('auth:loginPage.demoAccount.passwordLabel')}</span>
                  <span className="block truncate font-mono text-slate-800 text-[11px]">{selectedDemo.password}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedDemo.password, 'password')}
                  title={t('auth:loginPage.demoAccount.copyPasswordTitle')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {copiedField === 'password' ? (
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-600 animate-fade-in" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {/* Nút Đăng nhập 1-Click nhanh */}
              <button
                type="button"
                onClick={() => handleQuickLogin(selectedDemo)}
                disabled={login.isPending}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#1E3A8A] hover:bg-[#1E40AF] active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50 mt-1"
              >
                {login.isPending ? '...' : (
                  <>
                    <span>{t('auth:loginPage.demoAccount.quickLogin')}</span>
                    <span>&rarr;</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
