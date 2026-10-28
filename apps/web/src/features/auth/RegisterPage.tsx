import { useState, useRef, useEffect } from 'react';
import type { FormEvent, ClipboardEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { useRegisterOrganization } from './hooks';
import { AuthShell } from './components/AuthShell';
import { Stepper } from '@/components/ui/Stepper';
import type { StepItem } from '@/components/ui/Stepper';
import { FormField, Input, PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  BuildingIcon,
  HashIcon,
  UserIcon,
  MailIcon,
  LockIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '@/components/ui/Icons';
import { extractErrorMessage } from '@/lib/api-client';
// 28/10/2026 (merge Frontend2): canh bao mat khau co dau tieng Viet (dung chung voi LoginPage), thu gon
// khoang cach giua cac o nhap cua 2 buoc dang ky.
import { containsVietnameseDiacritics } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export interface RegisterWizardData {
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
  const registerOrgMutation = useRegisterOrganization();

  // Danh sách các bước trong Stepper (§2, §8)
  const STEPS: StepItem[] = [
    { id: 1, label: t('auth:registerPage.steps.organization') },
    { id: 2, label: t('auth:registerPage.steps.adminAccount') },
    { id: 3, label: t('auth:registerPage.steps.complete') },
  ];

  const [step, setStep] = useState<number>(1);
  const [data, setData] = useState<RegisterWizardData>({
    organizationName: '',
    taxCode: '',
    adminFullName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
  });

  const [errorKeys, setErrorKeys] = useState<Record<string, string>>({});
  const [systemError, setSystemError] = useState<string | null>(null);

  // Focus management: Focus heading khi chuyển step (§9)
  const headingRef = useRef<HTMLHeadingElement>(null);
  const adminFullNameRef = useRef<HTMLInputElement>(null);
  const adminEmailRef = useRef<HTMLInputElement>(null);
  const adminPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  if (accessToken && step !== 3) return <Navigate to="/dashboard" replace />;

  function update<K extends keyof RegisterWizardData>(key: K, value: RegisterWizardData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errorKeys[key]) {
      setErrorKeys((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    if (systemError) {
      setSystemError(null);
    }
  }

  /**
   * Tự động trim whitespace khi paste mã số thuế (không trim bên trong chuỗi) (§3, §7.2)
   */
  function handleTaxCodePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (text) {
      e.preventDefault();
      const trimmedText = text.trim();
      update('taxCode', trimmedText);
    }
  }

  /**
   * Validate dữ liệu Step 1 (§3):
   * - Tên tổ chức: bắt buộc, 2–100 ký tự.
   * - Mã số thuế: nếu có, phải là 10 hoặc 13 chữ số.
   */
  function validateStep1(): boolean {
    const nextErrors: Record<string, string> = {};
    const trimmedOrgName = data.organizationName.trim();

    if (!trimmedOrgName) {
      nextErrors.organizationName = 'orgNameRequired';
    } else if (trimmedOrgName.length < 2 || trimmedOrgName.length > 100) {
      nextErrors.organizationName = 'orgNameLength';
    }

    const trimmedTaxCode = data.taxCode.trim();
    if (trimmedTaxCode) {
      const isTaxCodeValid = /^\d{10}$/.test(trimmedTaxCode) || /^\d{13}$/.test(trimmedTaxCode);
      if (!isTaxCodeValid) {
        nextErrors.taxCode = 'taxCodeInvalid';
      }
    }

    setErrorKeys(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  /**
   * Validate dữ liệu Step 2 (§4):
   * - Họ tên: bắt buộc, 2–100 ký tự.
   * - Email: format chuẩn.
   * - Mật khẩu: >= 8 ký tự, gồm cả chữ và số.
   * - Xác nhận mật khẩu: khớp mật khẩu.
   */
  function validateStep2(): boolean {
    const nextErrors: Record<string, string> = {};
    const trimmedFullName = data.adminFullName.trim();
    const trimmedEmail = data.adminEmail.trim();

    if (!trimmedFullName) {
      nextErrors.adminFullName = 'adminFullNameRequired';
    } else if (trimmedFullName.length < 2 || trimmedFullName.length > 100) {
      nextErrors.adminFullName = 'adminFullNameLength';
    }

    if (!trimmedEmail) {
      nextErrors.adminEmail = 'adminEmailRequired';
    } else if (!EMAIL_RE.test(trimmedEmail)) {
      nextErrors.adminEmail = 'adminEmailInvalid';
    }

    if (!data.adminPassword) {
      nextErrors.adminPassword = 'adminPasswordRequired';
    } else if (!PASSWORD_PATTERN.test(data.adminPassword)) {
      nextErrors.adminPassword = 'adminPasswordFormat';
    }

    if (!data.confirmPassword) {
      nextErrors.confirmPassword = 'confirmPasswordRequired';
    } else if (data.confirmPassword !== data.adminPassword) {
      nextErrors.confirmPassword = 'confirmPasswordMismatch';
    }

    setErrorKeys(nextErrors);

    // Focus field lỗi đầu tiên (§4)
    if (nextErrors.adminFullName) {
      adminFullNameRef.current?.focus();
    } else if (nextErrors.adminEmail) {
      adminEmailRef.current?.focus();
    } else if (nextErrors.adminPassword) {
      adminPasswordRef.current?.focus();
    } else if (nextErrors.confirmPassword) {
      confirmPasswordRef.current?.focus();
    }

    return Object.keys(nextErrors).length === 0;
  }

  function handleStep1Submit(e: FormEvent) {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
    }
  }

  /**
   * Xử lý submit Step 2 (§4, §6):
   * - Khi server trả lỗi (trùng email hoặc lỗi hệ thống): Ở LẠI Step 2, KHÔNG toast, hiện lỗi inline.
   * - CHỈ khi server trả thành công (201/200) mới chuyển sang Step 3.
   */
  function handleStep2Submit(e: FormEvent) {
    e.preventDefault();
    setSystemError(null);

    if (!validateStep2()) {
      return;
    }

    registerOrgMutation.mutate(
      {
        organizationName: data.organizationName.trim(),
        taxCode: data.taxCode.trim() || undefined,
        adminFullName: data.adminFullName.trim(),
        adminEmail: data.adminEmail.trim(),
        adminPassword: data.adminPassword,
      },
      {
        onSuccess: () => {
          // BƯỚC THÀNH CÔNG: Chuyển sang Step 3
          setStep(3);
        },
        onError: (error) => {
          // Ở LẠI Step 2 - KHÔNG render Step 3, KHÔNG toast
          if (axios.isAxiosError(error) && error.response) {
            const status = error.response.status;
            const resData = error.response.data as { message?: string | string[]; errorCode?: string };

            if (
              status === 409 ||
              resData?.errorCode === 'EMAIL_ALREADY_USED_BY_ORG' ||
              (typeof resData?.message === 'string' && resData.message.toLowerCase().includes('email'))
            ) {
              setErrorKeys((prev) => ({
                ...prev,
                adminEmail: 'emailAlreadyUsed',
              }));
              adminEmailRef.current?.focus();
              return;
            }

            // Lỗi hệ thống hoặc validation khác từ server
            const fallbackMsg = t('auth:registerPage.errors.genericError');
            const message = extractErrorMessage(error, fallbackMsg);
            setSystemError(message);
          } else {
            setSystemError(t('auth:registerPage.errors.genericError'));
          }
        },
      },
    );
  }

  return (
    <AuthShell maxWidth={480}>
      {/* 2. Stepper Component (§2, §3, §4, §7.3) */}
      <Stepper
        steps={STEPS}
        currentStep={step}
        onStepClick={(targetStep) => {
          // Chỉ step Done mới clickable (§7.3)
          if (targetStep < step) {
            setStep(targetStep);
          }
        }}
      />

      {/* 3. Heading & 4. Subheading (§3, §4, §8) - chỉ hiển thị ở Step 1 & Step 2 */}
      {step < 3 && (
        <>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-sans text-[28px] leading-9 font-semibold text-text-primary mb-1.5 outline-none"
          >
            {t('auth:registerPage.title')}
          </h1>
          <p className="font-sans text-sm leading-[22px] text-text-secondary mb-5">
            {t('auth:registerPage.subtitle')}
          </p>
        </>
      )}

      {/* Lỗi hệ thống inline ở đầu form (§6) */}
      {systemError && (
        <div
          role="alert"
          className="mb-6 p-3 rounded-radius-sm bg-red-50 border border-red-200 text-xs leading-5 text-error flex items-start gap-2"
        >
          <span className="font-medium">{systemError}</span>
        </div>
      )}

      {/* =========================================================================
          STEP 1: THÔNG TIN TỔ CHỨC (§3)
          ========================================================================= */}
      {step === 1 && (
        <form onSubmit={handleStep1Submit} noValidate className="flex flex-col">
          {/* Field Tên tổ chức (*) */}
          <div className="mb-2.5">
            <FormField
              label={t('auth:registerPage.step1.orgNameLabel')}
              htmlFor="organizationName"
              error={errorKeys.organizationName ? t(`auth:registerPage.errors.${errorKeys.organizationName}`) : undefined}
              required
              reserveMessageSpace
            >
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                  <BuildingIcon className="w-4 h-4 stroke-[1.5]" />
                </div>
                <Input
                  id="organizationName"
                  className="pl-9"
                  placeholder={t('auth:registerPage.step1.orgNamePlaceholder')}
                  value={data.organizationName}
                  onChange={(e) => update('organizationName', e.target.value)}
                  autoFocus
                />
              </div>
            </FormField>
          </div>

          {/* Field Mã số thuế (Không bắt buộc) */}
          <div className="mb-4">
            <FormField
              label={
                <span className="flex items-center">
                  <span>{t('auth:registerPage.step1.taxCodeLabel')}</span>
                  <span className="ml-1 text-xs font-normal text-text-tertiary">
                    {t('auth:registerPage.step1.taxCodeOptional')}
                  </span>
                </span>
              }
              htmlFor="taxCode"
              error={errorKeys.taxCode ? t(`auth:registerPage.errors.${errorKeys.taxCode}`) : undefined}
              reserveMessageSpace
            >
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                  <HashIcon className="w-4 h-4 stroke-[1.5]" />
                </div>
                <Input
                  id="taxCode"
                  className="pl-9 font-mono"
                  placeholder={t('auth:registerPage.step1.taxCodePlaceholder', '0123456789')}
                  value={data.taxCode}
                  onPaste={handleTaxCodePaste}
                  onChange={(e) => update('taxCode', e.target.value)}
                />
              </div>
            </FormField>
          </div>

          {/* Nút Tiếp tục */}
          <Button type="submit" variant="primary" size="lg" className="w-full h-11 bg-[#1C1B1A] hover:bg-[#2E2C29] text-white">
            {t('auth:registerPage.step1.continue')}
          </Button>

          {/* Link Đã có tài khoản? Đăng nhập */}
          <div className="mt-6 text-center text-sm leading-[22px] text-text-secondary">
            <span>{t('auth:registerPage.hasAccount')} </span>
            <Link
              to="/login"
              className="text-[#0E5E5E] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E5E5E]/30 rounded-xs"
            >
              {t('auth:registerPage.loginLink')}
            </Link>
          </div>
        </form>
      )}

      {/* =========================================================================
          STEP 2: TÀI KHOẢN QUẢN TRỊ (§4)
          ========================================================================= */}
      {step === 2 && (
        <form onSubmit={handleStep2Submit} noValidate className="flex flex-col">
          {/* 3. Field Họ và tên quản trị viên (*) */}
          <div className="mb-2.5">
            <FormField
              label={t('auth:registerPage.step2.adminFullNameLabel')}
              htmlFor="adminFullName"
              error={errorKeys.adminFullName ? t(`auth:registerPage.errors.${errorKeys.adminFullName}`) : undefined}
              required
              reserveMessageSpace
            >
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                  <UserIcon className="w-4 h-4 stroke-[1.5]" />
                </div>
                <Input
                  ref={adminFullNameRef}
                  id="adminFullName"
                  className="pl-9"
                  placeholder={t('auth:registerPage.step2.adminFullNamePlaceholder')}
                  value={data.adminFullName}
                  onChange={(e) => update('adminFullName', e.target.value)}
                  autoFocus
                />
              </div>
            </FormField>
          </div>

          {/* 4. Field Email quản trị viên (*) */}
          <div className="mb-2.5">
            <FormField
              label={t('auth:registerPage.step2.adminEmailLabel')}
              htmlFor="adminEmail"
              error={errorKeys.adminEmail ? t(`auth:registerPage.errors.${errorKeys.adminEmail}`) : undefined}
              required
              reserveMessageSpace
            >
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                  <MailIcon className="w-4 h-4 stroke-[1.5]" />
                </div>
                <Input
                  ref={adminEmailRef}
                  id="adminEmail"
                  type="email"
                  className="pl-9"
                  placeholder={t('auth:registerPage.step2.adminEmailPlaceholder', 'admin@congty.com')}
                  value={data.adminEmail}
                  onChange={(e) => update('adminEmail', e.target.value)}
                />
              </div>
            </FormField>
          </div>

          {/* 5. Field Mật khẩu (*) - Xếp dọc */}
          <div className="mb-2.5">
            <FormField
              label={t('auth:registerPage.step2.adminPasswordLabel')}
              warning={!errorKeys.adminPassword && containsVietnameseDiacritics(data.adminPassword) ? t('common:password.diacriticsWarning') : undefined}
              htmlFor="adminPassword"
              error={errorKeys.adminPassword ? t(`auth:registerPage.errors.${errorKeys.adminPassword}`) : undefined}
              required
              reserveMessageSpace
            >
              <PasswordInput
                ref={adminPasswordRef}
                id="adminPassword"
                placeholder={t('auth:registerPage.step2.adminPasswordPlaceholder')}
                value={data.adminPassword}
                onChange={(e) => update('adminPassword', e.target.value)}
                leftIcon={<LockIcon className="w-4 h-4 stroke-[1.5]" />}
              />
            </FormField>
          </div>

          {/* 6. Field Xác nhận mật khẩu (*) - Xếp dọc */}
          <div className="mb-4">
            <FormField
              label={t('auth:registerPage.step2.confirmPasswordLabel')}
              warning={!errorKeys.confirmPassword && containsVietnameseDiacritics(data.confirmPassword) ? t('common:password.diacriticsWarning') : undefined}
              htmlFor="confirmPassword"
              error={errorKeys.confirmPassword ? t(`auth:registerPage.errors.${errorKeys.confirmPassword}`) : undefined}
              required
              reserveMessageSpace
            >
              <PasswordInput
                ref={confirmPasswordRef}
                id="confirmPassword"
                placeholder={t('auth:registerPage.step2.confirmPasswordPlaceholder')}
                value={data.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                leftIcon={<LockIcon className="w-4 h-4 stroke-[1.5]" />}
              />
            </FormField>
          </div>

          {/* 7. Hàng nút: Quay lại (~40%) + Hoàn tất đăng ký (~60%) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setErrorKeys({});
                setSystemError(null);
                setStep(1);
              }}
              className="w-[40%] h-11 inline-flex items-center justify-center gap-1.5 rounded-radius-sm border border-[#D1D5DB] bg-transparent text-sm font-medium text-text-primary hover:bg-[#F3F4F6] transition-colors cursor-pointer"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" />
              <span>{t('auth:registerPage.step2.back')}</span>
            </button>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={registerOrgMutation.isPending}
              className="w-[60%] h-11 bg-[#1C1B1A] hover:bg-[#2E2C29] text-white"
            >
              {registerOrgMutation.isPending
                ? t('auth:registerPage.step2.submitting')
                : t('auth:registerPage.step2.finish')}
            </Button>
          </div>

          {/* 8. Link Đã có tài khoản? Đăng nhập */}
          <div className="mt-6 text-center text-sm leading-[22px] text-text-secondary">
            <span>{t('auth:registerPage.hasAccount')} </span>
            <Link
              to="/login"
              className="text-[#0E5E5E] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E5E5E]/30 rounded-xs"
            >
              {t('auth:registerPage.loginLink')}
            </Link>
          </div>
        </form>
      )}

      {/* =========================================================================
          STEP 3: HOÀN TẤT (Success only) (§5)
          - Stepper: cả 3 step = Done (handled in Stepper component when currentStep=3)
          - Icon check-circle 64x64, stroke 1.5, màu accent #0E5E5E. Căn giữa, mb-6.
          - Heading font 22/30 weight 600, căn giữa, mb-3.
          - Mô tả font 14/22 text-secondary, căn giữa, max-w 380, mb-6.
          - Panel tóm tắt: nền bg-subtle, radius-md, p-4, border border-subtle, 3 dòng, mb-8.
          - CTA Vào không gian làm việc: ink, full-width, h-11, icon arrow-right bên phải gap 1.5.
          - Link phụ Về trang chủ: font 13 text-secondary, mt-4.
          - Fade transition 180ms.
          ========================================================================= */}
      {step === 3 && (
        <div className="transition-opacity duration-180 opacity-100 flex flex-col items-center">
          {/* 2. Icon check-circle 64x64, stroke 1.5, màu #0E5E5E */}
          <div className="mb-6 flex items-center justify-center text-[#0E5E5E]">
            <CheckCircleIcon className="w-16 h-16 stroke-[1.5]" />
          </div>

          {/* 3. Heading */}
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[22px] leading-[30px] font-semibold text-text-primary text-center mb-3 outline-none"
          >
            {t('auth:registerPage.step3.title')}
          </h1>

          {/* 4. Mô tả */}
          <p className="text-sm leading-[22px] text-text-secondary text-center max-w-[380px] mb-6">
            {t('auth:registerPage.step3.descriptionPrefix')}{' '}
            <span className="font-mono font-medium text-text-primary">{data.organizationName}</span>{' '}
            {t('auth:registerPage.step3.descriptionSuffix')}
          </p>

          {/* 5. Tóm tắt tổ chức — panel */}
          <div className="w-full bg-[#F3F4F6] rounded-radius-md p-4 border border-[#E5E7EB] mb-8">
            <div className="flex flex-col gap-2.5">
              {/* Dòng 1: Tên tổ chức */}
              <div className="flex items-center justify-between text-left">
                <span className="text-xs text-text-tertiary">
                  {t('auth:registerPage.step3.summaryOrgName')}
                </span>
                <span className="text-[13px] font-medium text-text-primary text-right max-w-[260px] truncate">
                  {data.organizationName}
                </span>
              </div>

              {/* Dòng 2: Mã số thuế */}
              <div className="flex items-center justify-between text-left">
                <span className="text-xs text-text-tertiary">
                  {t('auth:registerPage.step3.summaryTaxCode')}
                </span>
                <span className="text-[13px] font-mono font-medium text-text-primary text-right">
                  {data.taxCode.trim() || '—'}
                </span>
              </div>

              {/* Dòng 3: Quản trị viên */}
              <div className="flex items-center justify-between text-left">
                <span className="text-xs text-text-tertiary">
                  {t('auth:registerPage.step3.summaryAdmin')}
                </span>
                <span className="text-[13px] font-medium text-text-primary text-right max-w-[260px] truncate">
                  {data.adminFullName}
                  <span className="text-xs text-text-secondary font-normal ml-1">({data.adminEmail})</span>
                </span>
              </div>
            </div>
          </div>

          {/* 6. Nút CTA Vào không gian làm việc */}
          <Button
            type="button"
            onClick={() => {
              navigate('/dashboard', { replace: true });
            }}
            className="w-full h-11 bg-[#1C1B1A] hover:bg-[#2E2C29] text-white inline-flex items-center justify-center gap-1.5"
          >
            <span>{t('auth:registerPage.step3.cta')}</span>
            <ArrowRightIcon className="w-4 h-4" />
          </Button>

          {/* 7. Link phụ Về trang chủ */}
          <div className="mt-4 text-center">
            <Link
              to="/"
              className="text-[13px] leading-5 text-text-secondary hover:text-text-primary transition-colors inline-block"
            >
              {t('auth:registerPage.step3.homeLink')}
            </Link>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
