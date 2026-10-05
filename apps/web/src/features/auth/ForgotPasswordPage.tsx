import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useForgotPassword } from './hooks';
import { AuthShell } from './components/AuthShell';
import { FormField, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ArrowLeftIcon, MailCheckIcon } from '@/components/ui/Icons';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INITIAL_COOLDOWN = 60;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const forgotPassword = useForgotPassword();

  const [email, setEmail] = useState('');
  const [errorKey, setErrorKey] = useState<'emailRequired' | 'emailInvalid' | 'emailNotFound' | 'networkError' | undefined>();
  const [state, setState] = useState<'A' | 'B'>('A');
  const [countdown, setCountdown] = useState<number>(INITIAL_COOLDOWN);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const stateBHeadingRef = useRef<HTMLHeadingElement>(null);

  // Lưu và dọn dẹp interval triệt để chống memory leak
  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null;

    if (state === 'B') {
      // Focus tự động vào heading State B (§4.3, §7)
      stateBHeadingRef.current?.focus();

      if (countdown > 0) {
        timerId = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              if (timerId) clearInterval(timerId);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }

    return () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };
  }, [state, countdown]);

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
    if (forgotPassword.isPending) return;
    if (!validate()) return;
    forgotPassword.mutate(
      { email: email.trim() },
      {
        onSuccess: () => {
          setCountdown(INITIAL_COOLDOWN);
          setState('B');
        },
        onError: () => {
          setErrorKey('networkError');
        },
      },
    );
  }

  function handleResend() {
    if (countdown > 0 || forgotPassword.isPending) return;
    forgotPassword.mutate(
      { email: email.trim() },
      {
        onSuccess: () => {
          setCountdown(INITIAL_COOLDOWN);
        },
        onError: () => {
          // Vẫn giữ ở State B
        },
      },
    );
  }

  function handleChangeEmail() {
    setErrorKey(undefined);
    setState('A');
    // §4.1: Giữ nguyên email, auto-focus, đặt con trỏ ở cuối chuỗi
    setTimeout(() => {
      if (emailInputRef.current) {
        const input = emailInputRef.current;
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }, 0);
  }

  const emailError = errorKey ? t(`auth:forgotPasswordPage.errors.${errorKey}`) : undefined;

  return (
    <AuthShell>
      {state === 'A' ? (
        /* =========================================================================
           STATE A: FORM NHẬP EMAIL (§2)
           ========================================================================= */
        <div key="state-a" className="flex flex-col w-full fade-in-180">
          {/* 2. Tiêu đề Quên mật khẩu */}
          <h2 className="font-sans text-[28px] leading-9 font-semibold text-text-primary mb-1.5">
            {t('auth:forgotPasswordPage.title', 'Quên mật khẩu')}
          </h2>

          {/* 3. Phụ đề - text-wrap: balance tránh rớt từ đơn lẻ */}
          <p className="font-sans text-sm leading-[22px] text-text-secondary mb-8 max-w-[380px] [text-wrap:balance]">
            {t('auth:forgotPasswordPage.subtitle', 'Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu')}
          </p>

          {/* 4. Form */}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col">
            {/* Field Email */}
            <div className="mb-4">
              <FormField
                label={t('auth:forgotPasswordPage.emailLabel', 'Email')}
                htmlFor="forgot-email"
                error={emailError}
                required
                reserveMessageSpace
              >
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                  <Input
                    ref={emailInputRef}
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('auth:forgotPasswordPage.emailPlaceholder', 'ban@congty.com')}
                    value={email}
                    className="pl-9 pr-3"
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorKey) setErrorKey(undefined);
                    }}
                  />
                </div>
              </FormField>
            </div>

            {/* 5. Nút submit — primary ink, full-width, height 44, radius 6px */}
            <Button
              type="submit"
              className="w-full h-11 text-sm font-medium bg-[#1C1B1A] text-[#F7F6F3] hover:bg-[#2E2C29] active:bg-[#141312] rounded-radius-md"
              isLoading={forgotPassword.isPending}
              disabled={forgotPassword.isPending}
              aria-busy={forgotPassword.isPending}
              aria-disabled={forgotPassword.isPending}
            >
              {forgotPassword.isPending
                ? t('auth:forgotPasswordPage.submitting', 'Đang gửi…')
                : t('auth:forgotPasswordPage.submit', 'Gửi liên kết đặt lại')}
            </Button>
          </form>

          {/* 6. Link quay lại — ghost, icon arrow-left 14px, căn giữa, mt-6 */}
          <div className="mt-6 flex justify-center">
            <Link
              to="/login"
              state={{ email: email.trim() }}
              className="inline-flex items-center gap-1.5 text-[13px] leading-5 text-text-secondary hover:text-accent transition-colors"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('auth:forgotPasswordPage.backToLogin', 'Quay lại đăng nhập')}</span>
            </Link>
          </div>
        </div>
      ) : (
        /* =========================================================================
           STATE B: SUCCESS / CHECK EMAIL SCREEN (§3)
           ========================================================================= */
        <div key="state-b" className="flex flex-col items-center text-center w-full fade-in-180">
          {/* 1. Icon trạng thái — mail-check 56x56, stroke 1.5, màu accent #0E5E5E (§3.1) */}
          <div className="mb-6 text-accent flex items-center justify-center">
            <MailCheckIcon className="w-14 h-14" strokeWidth={1.5} aria-hidden="true" />
          </div>

          {/* 2. Tiêu đề: font 22/30 weight 600, text-primary, căn giữa (§3.2) */}
          <h2
            ref={stateBHeadingRef}
            tabIndex={-1}
            role="status"
            className="font-sans text-[22px] leading-[30px] font-semibold text-text-primary mb-3 outline-none"
          >
            {t('auth:forgotPasswordPage.stateB.title', 'Kiểm tra hộp thư của bạn')}
          </h2>

          {/* 3. Mô tả: email font-mono, weight 500, màu text-primary (§3.3, §5.4) */}
          <p className="font-sans text-sm leading-[22px] text-text-secondary mb-8 max-w-[380px]">
            {t('auth:forgotPasswordPage.stateB.description', 'Chúng tôi đã gửi liên kết đặt lại mật khẩu đến')}{' '}
            <span className="font-mono font-medium text-text-primary break-all">{email.trim()}</span>
          </p>

          {/* 4. Khối cooldown / resend (§3.4) */}
          <div className="flex flex-col items-center min-h-[24px]">
            {countdown > 0 ? (
              <span className="text-[13px] leading-5 text-text-tertiary select-none" aria-live="off">
                {t('auth:forgotPasswordPage.stateB.cooldown', 'Gửi lại sau {{seconds}}s', { seconds: countdown })}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={forgotPassword.isPending}
                aria-live="polite"
                className="text-[13px] leading-5 font-medium text-accent hover:text-accent-hover transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {forgotPassword.isPending ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span>{t('auth:forgotPasswordPage.submitting', 'Đang gửi…')}</span>
                  </>
                ) : (
                  <span>{t('auth:forgotPasswordPage.stateB.resend', 'Gửi lại liên kết')}</span>
                )}
              </button>
            )}
          </div>

          {/* 5. Link Nhập lại email khác — ghost button, font 13/20, mt-4 (§3.5) */}
          <button
            type="button"
            onClick={handleChangeEmail}
            className="mt-4 text-[13px] leading-5 text-text-secondary hover:text-accent transition-colors cursor-pointer"
          >
            {t('auth:forgotPasswordPage.stateB.changeEmail', 'Nhập lại email khác')}
          </button>

          {/* 6. Link quay lại Login — ghost button icon arrow-left, mt-8 (§3.6) */}
          <div className="mt-8 flex justify-center">
            <Link
              to="/login"
              state={{ email: email.trim() }}
              className="inline-flex items-center gap-1.5 text-[13px] leading-5 text-text-secondary hover:text-accent transition-colors"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('auth:forgotPasswordPage.backToLogin', 'Quay lại đăng nhập')}</span>
            </Link>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
