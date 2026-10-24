import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLogout } from '@/features/auth/hooks';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { CascadeLogoIcon, LogOutIcon } from '@/components/ui/Icons';

export const PlatformAdminHeader = memo(function PlatformAdminHeader() {
  const { t } = useTranslation();
  const logout = useLogout();

  return (
    <header className="border-b border-border-subtle bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-text-primary">
              <CascadeLogoIcon className="h-6 w-6 text-[#1C1B1A]" />
            </span>
            <span className="text-base font-semibold text-text-primary tracking-tight">EFS</span>
          </div>
          <div className="h-5 w-px bg-border-subtle" aria-hidden="true" />
          <div>
            <h1 className="text-[16px] leading-[24px] font-semibold text-text-primary">{t('platformAdmin:page.title')}</h1>
            <p className="text-[12px] leading-[16px] font-normal text-text-tertiary">Super Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-radius-sm border border-border-strong bg-white px-3 text-[13px] font-medium text-text-primary transition-colors hover:bg-bg-subtle cursor-pointer disabled:opacity-50"
          >
            <LogOutIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{t('platformAdmin:page.logout')}</span>
          </button>
        </div>
      </div>
    </header>
  );
});

