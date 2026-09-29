import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useForgotPassword } from './hooks';
import { FormField, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  MailIcon,
  InfoIcon,
  BrandLogoIcon,
  ChevronLeftIcon,
  CheckCircleIcon,
} from '@/components/ui/Icons';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

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
            {t('auth:forgotPasswordPage.hero.tagline')}
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

        {/* KHU VỰC GIỮA: Form căn giữa theo chiều dọc */}
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

          {/* Tiêu đề & Dòng phụ (Không có cụm logo thừa phía trên) */}
          <div className="mb-6">
            <h2 className="font-heading text-[28px] font-semibold text-[#1E3A8A] tracking-tight">
              {t('auth:forgotPasswordPage.title')}
            </h2>
            <p className="mt-1.5 font-sans text-sm text-[#6B7280]">
              {t('auth:forgotPasswordPage.subtitle')}
            </p>
          </div>

          {submitted ? (
            /* Trạng thái sau khi gửi thành công */
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 text-center shadow-xs">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircleIcon className="h-6 w-6" />
              </div>
              <p className="font-sans text-sm leading-relaxed text-slate-700">
                {t('auth:forgotPasswordPage.submittedMessage', { email: email.trim() })}
              </p>
              <div className="mt-6">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 font-bold text-[#1E3A8A] transition-colors duration-150 hover:underline hover:text-[#1E40AF]"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  <span>{t('auth:forgotPasswordPage.backToLogin')}</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Form nhập email */
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <FormField
                label={t('auth:forgotPasswordPage.emailLabel')}
                htmlFor="email"
                error={emailError}
                required
              >
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <MailIcon className="h-4 w-4" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('auth:forgotPasswordPage.emailPlaceholder')}
                    value={email}
                    className="pl-9 h-11 rounded-[8px] border-[#E5E7EB] focus:border-[#1E3A8A] focus:ring-[#1E3A8A]"
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorKey) setErrorKey(undefined);
                    }}
                  />
                </div>
              </FormField>

              <Button
                type="submit"
                className="w-full h-[44px] rounded-[8px] bg-[#1E3A8A] hover:bg-[#1E40AF] text-white font-sans text-sm font-semibold transition-colors duration-200 shadow-xs cursor-pointer active:scale-[0.98]"
                isLoading={forgotPassword.isPending}
              >
                {t('auth:forgotPasswordPage.submit')}
              </Button>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 font-bold text-[#1E3A8A] transition-colors duration-150 hover:underline hover:text-[#1E40AF]"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  <span>{t('auth:forgotPasswordPage.backToLogin')}</span>
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* HÀNG DƯỚI CÙNG: Dòng hỗ trợ người dùng */}
        <div className="pt-4 border-t border-slate-200/60 text-center font-sans text-xs text-[#6B7280]">
          <span>Cần hỗ trợ? Liên hệ <a href="mailto:support@ecap.vn" className="text-[#1E3A8A] font-medium hover:underline">support@ecap.vn</a></span>
        </div>
      </div>
    </div>
  );
}
