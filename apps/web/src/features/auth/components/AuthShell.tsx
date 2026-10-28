import { memo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { MockDashboardPreview } from './MockDashboardPreview';

interface AuthShellProps {
  children: ReactNode;
  /** Widget cố định như QuickLoginWidget (chỉ dùng ở Login) */
  extraWidget?: ReactNode;
  /** Độ rộng tối đa của cột form (mặc định 380px cho Login/Forgot, 480px cho Register/Sign up) */
  maxWidth?: 380 | 480 | number;
}

export const AuthShell = memo(function AuthShell({ children, extraWidget, maxWidth = 380 }: AuthShellProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="min-h-screen w-full flex flex-col lg:flex-row bg-bg-canvas text-text-primary antialiased font-sans">
        {/* =========================================================================
            CỘT TRÁI — BRANDING (§B.1, §B.2, §B.3): flex: 55%, nền ink #1C1B1A (lg trở lên)
            ========================================================================= */}
        <div className="hidden lg:flex lg:w-[55%] min-h-screen bg-[#1C1B1A] text-[#F7F6F3] p-12 flex-col justify-between">
          <div className="flex flex-col">
            {/* Logo Lockup Branding: Mark 28px + Wordmark 20px (gap 10px) */}
            <div className="flex items-center gap-2.5 mb-16">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F7F6F3" strokeWidth="2" strokeLinecap="round">
                <path d="M3 7h8" />
                <path d="M7 12h9" />
                <path d="M11 17h10" />
              </svg>
              <span className="font-sans text-xl leading-6 font-semibold tracking-[-0.01em] text-[#F7F6F3]">
                EFS
              </span>
            </div>

            {/* Tiêu đề chính + Phụ đề */}
            <h1 className="font-sans text-[28px] leading-9 font-semibold text-[#F7F6F3] max-w-[380px] mb-3">
              <span>{t('auth:loginPage.brandingHeading')}</span>
              <br />
              <span>{t('auth:loginPage.brandingHeadingAccent')} {t('auth:loginPage.brandingHeadingEnd')}</span>
            </h1>
            <p className="font-sans text-sm leading-[22px] text-[#F7F6F3]/60 mb-10">
              {t('auth:loginPage.brandingSubheading')}
            </p>

            {/* Mock Dashboard Preview (§B.3) */}
            <MockDashboardPreview />

            {/* 3 Bullet giá trị */}
            <div className="mt-10 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-[13px] leading-5 text-[#F7F6F3]/70">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0E5E5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{t('auth:loginPage.featureRealtime')}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] leading-5 text-[#F7F6F3]/70">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0E5E5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{t('auth:loginPage.featureCollab')}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] leading-5 text-[#F7F6F3]/70">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0E5E5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{t('auth:loginPage.featureReporting')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            CỘT PHẢI — FORM (§B.1, §B.4): flex: 45%, nền #F7F6F3
            28/10/2026 (merge Frontend2): đệm dọc py-12 -> py-8 (lg: py-6) để form Đăng ký 2 bước vừa 1 màn hình.
            ========================================================================= */}
        <div className="relative flex-1 lg:w-[45%] min-h-screen bg-[#F7F6F3] flex flex-col justify-center items-center px-6 py-8 lg:py-6">
          {/* Language Switcher (§A.3, §B.4): Góc trên phải */}
          <div className="absolute top-4 right-4 md:top-5 md:right-5 lg:top-6 lg:right-6 z-20">
            <LanguageSwitcher />
          </div>

          {/* Khung Form: max-width 380px hoặc 480px, không dùng card */}
          <div
            className="w-full flex flex-col"
            style={{ maxWidth: `${maxWidth}px` }}
          >
            {/* Logo lockup nhỏ hiển thị trên mobile (< lg) */}
            <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1C1B1A" strokeWidth="2" strokeLinecap="round">
                <path d="M3 7h8" />
                <path d="M7 12h9" />
                <path d="M11 17h10" />
              </svg>
              <span className="font-sans text-lg font-semibold tracking-[-0.01em] text-text-primary">
                EFS
              </span>
            </div>

            {children}
          </div>
        </div>
      </div>

      {extraWidget}
    </>
  );
});
