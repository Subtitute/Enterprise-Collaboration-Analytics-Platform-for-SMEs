import { useTranslation } from 'react-i18next';
import { Dropdown, DropdownItem } from './Dropdown';
import { GlobeIcon, CheckIcon, ChevronDownIcon } from './Icons';
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
 *
 * 21/08/2026: KHONG nhan prop dinh vi (vd className="absolute ...") - Dropdown boc trigger trong
 * 1 the div "relative inline-block" rieng cua no; neu trigger tro thanh position:absolute thi the
 * div boc do sup ve kich thuoc 0 (xem loi thuc te da sua tai AuthLayout.tsx). Noi nao can dinh vi
 * tuyet doi cho nut nay thi boc 1 the <div> dinh vi o BEN NGOAI, giu component nay khong doi.
 */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const language = useI18nStore((s) => s.language);
  const setLanguage = useI18nStore((s) => s.setLanguage);

  return (
    <Dropdown
      align="right"
      panelClassName="min-w-[140px] shadow-md rounded-radius-md border border-border-subtle bg-bg-surface p-1"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={t('common:language.switcherLabel')}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-radius-md px-2 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-subtle cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft',
            open && 'bg-bg-subtle text-text-primary',
          )}
        >
          <GlobeIcon className="h-4 w-4 shrink-0 text-text-secondary" />
          <span className="uppercase text-xs font-medium text-text-primary">{language}</span>
          <ChevronDownIcon className={cn('h-3 w-3 text-text-tertiary transition-transform duration-200', open && 'rotate-180')} />
        </button>
      )}
    >
      {({ close }) => (
        <div className="py-0.5 space-y-0.5">
          {SUPPORTED_LANGUAGES.map((lng: SupportedLanguage) => {
            const isSelected = language === lng;
            return (
              <DropdownItem
                key={lng}
                onClick={() => {
                  setLanguage(lng);
                  close();
                }}
                className={cn(
                  'h-8 px-2.5 py-1.5 rounded-radius-sm text-[13px] leading-5 flex items-center justify-between',
                  isSelected
                    ? 'bg-accent-soft text-accent font-medium hover:bg-accent-soft'
                    : 'text-text-primary hover:bg-bg-subtle',
                )}
              >
                <span>{t(`common:language.${lng}`)}</span>
                {isSelected && <CheckIcon className="h-3.5 w-3.5 text-accent shrink-0" />}
              </DropdownItem>
            );
          })}
        </div>
      )}
    </Dropdown>
  );
}
