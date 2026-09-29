import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useRegisterOrganization } from './hooks';
import { FormField, Input, PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  CheckIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  InfoIcon,
  BrandLogoIcon,
} from '@/components/ui/Icons';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { extractErrorMessage } from '@/lib/api-client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface WizardData {
  organizationName: string;
  taxCode: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
  confirmPassword: string;
}

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const registerOrg = useRegisterOrganization();

  const STEPS = [
    { step: 1, label: t('auth:registerPage.steps.organization') },
    { step: 2, label: t('auth:registerPage.steps.adminAccount') },
    { step: 3, label: t('auth:registerPage.steps.complete') },
  ];

  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    organizationName: '',
    taxCode: '',
    adminFullName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
  });
  const [errorKeys, setErrorKeys] = useState<Record<string, string>>({});

  if (accessToken) return <Navigate to="/dashboard" replace />;

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }));
    if (errorKeys[key]) {
      setErrorKeys((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function validateStep1() {
    const next: Record<string, string> = {};
    if (!data.organizationName.trim()) next.organizationName = 'organizationNameRequired';
    setErrorKeys(next);
    return Object.keys(next).length === 0;
  }

  function validateStep2() {
    const next: Record<string, string> = {};
    if (!data.adminFullName.trim()) next.adminFullName = 'adminFullNameRequired';
    if (!data.adminEmail.trim()) next.adminEmail = 'adminEmailRequired';
    else if (!EMAIL_RE.test(data.adminEmail.trim())) next.adminEmail = 'adminEmailInvalid';
    if (!data.adminPassword) next.adminPassword = 'adminPasswordRequired';
    else if (data.adminPassword.length < 8) next.adminPassword = 'adminPasswordTooShort';
    if (data.confirmPassword !== data.adminPassword) next.confirmPassword = 'confirmPasswordMismatch';
    setErrorKeys(next);
    return Object.keys(next).length === 0;
  }

  function handleNext(e: FormEvent) {
    e.preventDefault();
    if (step === 1 && validateStep1()) setStep(2);
  }

  function handleFinish(e: FormEvent) {
    e.preventDefault();
    if (!validateStep2()) return;
    setStep(3);
    registerOrg.mutate({
      organizationName: data.organizationName.trim(),
      taxCode: data.taxCode.trim() || undefined,
      adminFullName: data.adminFullName.trim(),
      adminEmail: data.adminEmail.trim(),
      adminPassword: data.adminPassword,
    });
  }

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

        {/* TRÊN CÙNG: Logo ECAP 3 nút tròn + badge "for SMEs" */}
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

        {/* Ở GIỮA: Tagline và 3 value props */}
        <div className="relative z-10 max-w-xl my-auto py-12">
          <h1 className="font-heading text-3xl xl:text-[34px] font-semibold leading-snug text-white">
            {t('auth:registerPage.hero.tagline')}
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

        {/* DƯỚI CÙNG: Dòng copyright nhỏ font Lora/Roboto trắng mờ */}
        <div className="relative z-10 flex items-center justify-between font-sans text-xs text-white/60">
          <span>&copy; 2026 ECAP for SMEs &middot; v0.1.0</span>
          <span>{t('auth:loginPage.hero.securityStandard')}</span>
        </div>
      </div>

      {/* CỘT PHẢI: Chiếm 40-45% chiều rộng, nền #FAFAF9 */}
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

        {/* KHU VỰC GIỮA: Stepper + Form đăng ký căn giữa theo chiều dọc */}
        <div className="my-auto w-full max-w-md mx-auto py-8">
          {/* Header hiển thị logo trên mobile khi cột trái bị ẩn */}
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A8A] text-white shadow-xs">
              <BrandLogoIcon className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading text-xl font-bold tracking-wider text-[#1E3A8A]">
              ECAP
            </span>
            <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-700">
              for SMEs
            </span>
          </div>

          {/* Tiêu đề & Dòng phụ */}
          <div className="mb-6">
            <h2 className="font-heading text-[28px] font-semibold text-[#1E3A8A] tracking-tight">
              {t('auth:registerPage.title')}
            </h2>
            <p className="mt-1.5 font-sans text-sm text-[#6B7280]">
              {t('auth:registerPage.subtitle')}
            </p>
          </div>

          {/* Stepper (thanh tiến trình 3 bước) */}
          <div className="mb-8 w-full">
            <ol className="grid grid-cols-3 w-full">
              {STEPS.map((s, i) => {
                const isCompleted = step > s.step || (step === 3 && registerOrg.isSuccess);
                const isActive = step === s.step && !(step === 3 && registerOrg.isSuccess);
                return (
                  <li key={s.step} className="relative flex flex-col items-center text-center">
                    {/* Đường nối giữa các bước: mảnh 2px, đoạn đã qua màu #1E3A8A, chưa qua #E5E7EB */}
                    {i < STEPS.length - 1 && (
                      <div
                        className={`absolute top-4 left-1/2 w-full h-[2px] transition-colors duration-200 ${
                          step > s.step ? 'bg-[#1E3A8A]' : 'bg-[#E5E7EB]'
                        }`}
                        style={{ zIndex: 0 }}
                      />
                    )}

                    {/* Vòng tròn bước */}
                    <div className="relative z-10 flex flex-col items-center gap-1.5 w-full px-1">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 ${
                          isCompleted
                            ? 'bg-[#10B981] text-white shadow-xs'
                            : isActive
                              ? 'bg-[#1E3A8A] text-white shadow-sm ring-4 ring-[#EFF6FF]'
                              : 'bg-white border border-[#E5E7EB] text-[#9CA3AF]'
                        }`}
                      >
                        {isCompleted ? <CheckIcon className="h-4 w-4 text-white" /> : s.step}
                      </span>
                      <span
                        className={`text-xs font-medium leading-tight line-clamp-2 px-0.5 ${
                          step >= s.step ? 'text-slate-800' : 'text-[#9CA3AF]'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* BƯỚC 1: Thông tin tổ chức */}
          {step === 1 && (
            <form onSubmit={handleNext} className="space-y-4" noValidate>
              <FormField
                label={t('auth:registerPage.step1.organizationNameLabel')}
                htmlFor="organizationName"
                error={errorKeys.organizationName ? t(`auth:registerPage.errors.${errorKeys.organizationName}`) : undefined}
                required
              >
                <Input
                  id="organizationName"
                  placeholder={t('auth:registerPage.step1.organizationNamePlaceholder')}
                  value={data.organizationName}
                  onChange={(e) => update('organizationName', e.target.value)}
                  className="h-11 rounded-[8px] border-[#E5E7EB] focus:border-[#1E3A8A] focus:ring-[#1E3A8A]"
                />
              </FormField>
              <FormField
                label={t('auth:registerPage.step1.taxCodeLabel')}
                htmlFor="taxCode"
                hint={t('auth:registerPage.step1.taxCodeHint')}
              >
                <Input
                  id="taxCode"
                  placeholder="0123456789"
                  value={data.taxCode}
                  onChange={(e) => update('taxCode', e.target.value)}
                  className="h-11 rounded-[8px] border-[#E5E7EB] focus:border-[#1E3A8A] focus:ring-[#1E3A8A]"
                />
              </FormField>
              <Button
                type="submit"
                className="w-full h-[44px] rounded-[8px] bg-[#1E3A8A] hover:bg-[#1E40AF] text-white font-sans text-sm font-semibold transition-colors duration-200 shadow-xs cursor-pointer active:scale-[0.98]"
              >
                {t('auth:registerPage.step1.continue')}
              </Button>
            </form>
          )}

          {/* BƯỚC 2: Tài khoản quản trị */}
          {step === 2 && (
            <form onSubmit={handleFinish} className="space-y-4" noValidate>
              <FormField
                label={t('auth:registerPage.step2.adminFullNameLabel')}
                htmlFor="adminFullName"
                error={errorKeys.adminFullName ? t(`auth:registerPage.errors.${errorKeys.adminFullName}`) : undefined}
                required
              >
                <Input
                  id="adminFullName"
                  placeholder={t('auth:registerPage.step2.adminFullNamePlaceholder')}
                  value={data.adminFullName}
                  onChange={(e) => update('adminFullName', e.target.value)}
                  className="h-11 rounded-[8px] border-[#E5E7EB] focus:border-[#1E3A8A] focus:ring-[#1E3A8A]"
                />
              </FormField>
              <FormField
                label={t('auth:registerPage.step2.adminEmailLabel')}
                htmlFor="adminEmail"
                error={errorKeys.adminEmail ? t(`auth:registerPage.errors.${errorKeys.adminEmail}`) : undefined}
                required
              >
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder={t('auth:registerPage.step2.adminEmailPlaceholder')}
                  value={data.adminEmail}
                  onChange={(e) => update('adminEmail', e.target.value)}
                  className="h-11 rounded-[8px] border-[#E5E7EB] focus:border-[#1E3A8A] focus:ring-[#1E3A8A]"
                />
              </FormField>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  label={t('auth:registerPage.step2.adminPasswordLabel')}
                  htmlFor="adminPassword"
                  error={errorKeys.adminPassword ? t(`auth:registerPage.errors.${errorKeys.adminPassword}`) : undefined}
                  required
                >
                  <PasswordInput
                    id="adminPassword"
                    placeholder={t('auth:registerPage.step2.adminPasswordPlaceholder')}
                    value={data.adminPassword}
                    onChange={(e) => update('adminPassword', e.target.value)}
                    className="h-11 rounded-[8px] border-[#E5E7EB] focus:border-[#1E3A8A] focus:ring-[#1E3A8A]"
                  />
                </FormField>
                <FormField
                  label={t('auth:registerPage.step2.confirmPasswordLabel')}
                  htmlFor="confirmPassword"
                  error={errorKeys.confirmPassword ? t(`auth:registerPage.errors.${errorKeys.confirmPassword}`) : undefined}
                  required
                >
                  <PasswordInput
                    id="confirmPassword"
                    placeholder={t('auth:registerPage.step2.confirmPasswordPlaceholder')}
                    value={data.confirmPassword}
                    onChange={(e) => update('confirmPassword', e.target.value)}
                    className="h-11 rounded-[8px] border-[#E5E7EB] focus:border-[#1E3A8A] focus:ring-[#1E3A8A]"
                  />
                </FormField>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 h-[44px] rounded-[8px] border border-[#1E3A8A] bg-white text-[#1E3A8A] hover:bg-[#EFF6FF] font-sans text-sm font-semibold transition-colors duration-200 cursor-pointer active:scale-[0.98]"
                >
                  {t('auth:registerPage.step2.back')}
                </button>
                <Button
                  type="submit"
                  className="flex-1 h-[44px] rounded-[8px] bg-[#1E3A8A] hover:bg-[#1E40AF] text-white font-sans text-sm font-semibold transition-colors duration-200 shadow-xs cursor-pointer active:scale-[0.98]"
                  isLoading={registerOrg.isPending}
                >
                  {t('auth:registerPage.step2.finish')}
                </Button>
              </div>
            </form>
          )}

          {/* BƯỚC 3: Hoàn tất */}
          {step === 3 && (
            <div className="py-4">
              {registerOrg.isError ? (
                /* Error state (thất bại) */
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 border border-amber-200">
                    <AlertCircleIcon className="h-8 w-8 text-[#F59E0B]" />
                  </div>
                  <h3 className="font-heading text-2xl font-semibold text-[#1E3A8A]">
                    {t('auth:registerPage.step3.errorTitle')}
                  </h3>
                  <p className="font-sans text-sm text-[#6B7280] max-w-sm">
                    {extractErrorMessage(registerOrg.error, t('auth:registerPage.step3.errorMessage'))}
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="mt-3 w-full h-[44px] rounded-[8px] border border-[#1E3A8A] bg-white text-[#1E3A8A] hover:bg-[#EFF6FF] font-sans text-sm font-semibold transition-colors duration-200 cursor-pointer active:scale-[0.98]"
                  >
                    {t('auth:registerPage.step3.backToEdit')}
                  </button>
                </div>
              ) : registerOrg.isSuccess ? (
                /* Success state (thành công) */
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                    <CheckCircleIcon className="h-8 w-8 text-[#10B981]" />
                  </div>
                  <h3 className="font-heading text-2xl font-semibold text-[#1E3A8A]">
                    {t('auth:registerPage.step3.successTitle')}
                  </h3>
                  <p className="font-sans text-sm text-[#6B7280] max-w-sm">
                    {t('auth:registerPage.step3.successSubtitle')}
                  </p>
                  <Button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="mt-3 w-full h-[44px] rounded-[8px] bg-[#1E3A8A] hover:bg-[#1E40AF] text-white font-sans text-sm font-semibold transition-colors duration-200 shadow-xs cursor-pointer active:scale-[0.98]"
                  >
                    {t('auth:registerPage.step3.loginNow')}
                  </Button>
                </div>
              ) : (
                /* Đang xử lý đăng ký */
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-[#EFF6FF] text-[#1E3A8A]">
                    <BrandLogoIcon className="h-7 w-7 text-[#1E3A8A] animate-spin" />
                  </span>
                  <p className="font-sans text-sm font-medium text-slate-700">
                    {t('auth:registerPage.step3.inProgress')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Link Đã có tài khoản? Đăng nhập */}
          <p className="mt-8 text-center font-sans text-sm text-[#6B7280]">
            {t('auth:registerPage.hasAccount')}{' '}
            <Link
              to="/login"
              className="font-bold text-[#1E3A8A] transition-colors duration-150 hover:underline hover:text-[#1E40AF]"
            >
              {t('auth:registerPage.loginLink')}
            </Link>
          </p>
        </div>

        {/* HÀNG DƯỚI CÙNG: Dòng hỗ trợ người dùng */}
        <div className="pt-4 border-t border-slate-200/60 text-center font-sans text-xs text-[#6B7280]">
          <span>{t('auth:loginPage.supportContact')} <a href="mailto:support@ecap.vn" className="text-[#1E3A8A] font-medium hover:underline">support@ecap.vn</a></span>
        </div>
      </div>
    </div>
  );
}
