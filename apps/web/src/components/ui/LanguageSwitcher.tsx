import { useTranslation } from 'react-i18next';
import { Dropdown, DropdownItem } from './Dropdown';
import { GlobeIcon, CheckIcon } from './Icons';
import { useI18nStore } from '@/stores/i18n.store';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

// 20/08/2026: t()/i18n.language khong dung de xac dinh "dang chon ngon ngu nao" o day - dung
// truc tiep useI18nStore (nguon that duy nhat, xem stores/i18n.store.ts), tranh 2 nguon trang
// thai (store + instance i18next) co the lech nhau tam thoi giua luc changeLanguage() dang chay.

/**
 * 20/08/2026: nut chon ngon ngu (Viet/Anh/Nhat) - dung o 2 noi: Topbar.tsx (moi trang da dang
 * nhap) va AuthLayout.tsx (dang nhap/dang ky). Dung lai Dropdown co san (portal, click-outside,
 * Esc - xem Dropdown.tsx) giong menu tai khoan tren Topbar.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation();
  const language = useI18nStore((s) => s.language);
  const setLanguage = useI18nStore((s) => s.setLanguage);

  return (
    <Dropdown
      align="right"
      panelClassName="w-40"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={t('common:language.switcherLabel')}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100',
            className,
          )}
        >
          <GlobeIcon className="h-5 w-5" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="py-1.5">
          {SUPPORTED_LANGUAGES.map((lng: SupportedLanguage) => (
            <DropdownItem
              key={lng}
              onClick={() => {
                setLanguage(lng);
                close();
              }}
            >
              <span className="flex-1">{t(`common:language.${lng}`)}</span>
              {language === lng && <CheckIcon className="h-4 w-4 text-primary-600" />}
            </DropdownItem>
          ))}
        </div>
      )}
    </Dropdown>
  );
}
