import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { HOME_SUB_NAV_ITEMS } from './nav-items';

/**
 * 03/10/2026: panel dieu huong cap 2 cho nhom "Trang chủ" (Dashboard/Dự án & Công việc/Tài liệu/
 * Khách hàng - xem nav-items.ts HOME_ROUTE_PREFIXES/HOME_SUB_NAV_ITEMS). AppShell.tsx chi mount
 * component nay khi path hien tai nam trong nhom do. Khac voi Sidebar.tsx (rail icon, mo rong CHI
 * khi hover, dinh vi overlay de khong day noi dung) - day la panel dung yen binh thuong (nam trong
 * luong flex, luon hien nhan chu), chi hep hon (w-56 thay vi w-60) vi chi can liet ke 4 muc.
 */
export function SecondarySidebar() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    // 03/10/2026: z-10 tuong minh (thap hon z-40 cua Sidebar.tsx khi hover va z-30 cua Topbar.tsx) -
    // dam bao panel nay KHONG bao giờ che len flyout cua rail chinh khi mo rong, du 2 <aside sticky>
    // la anh em cung cap trong AppShell.tsx (neu khong co z-index tuong minh, thu tu chong hinh mac
    // dinh phu thuoc thu tu DOM, de gay nham lan/loi khi co nguoi sua lai AppShell.tsx sau nay).
    <aside className="sticky top-0 z-10 hidden h-screen w-56 shrink-0 flex-col border-r border-border-subtle bg-bg-surface md:flex">
      {/* 3.2. Header 56px, padding-x 16, 2 dòng: overline 10/600 + title 15/600 */}
      <div className="flex h-14 shrink-0 flex-col justify-center border-b border-border-subtle px-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
          DASHBOARD
        </span>
        <span className="mt-0.5 truncate text-[15px] font-semibold leading-none text-text-primary">
          {t('common:nav.home')}
        </span>
      </div>
      <nav aria-label={t('common:nav.homeGroupAria')} className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-2 py-2">
        {HOME_SUB_NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              className={() =>
                cn(
                  'group relative flex h-9 items-center rounded-radius-sm px-2.5 text-[13px] font-normal transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-soft',
                  isActive
                    ? 'bg-accent-soft text-accent font-medium'
                    : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary',
                )
              }
            >
              {/* 3.3. Icon 16px (h-4 w-4), stroke 1.5, text-secondary mac dinh */}
              <item.icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors duration-150',
                  isActive ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary',
                )}
              />
              <span className="ml-2.5 truncate">{t(item.labelKey)}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
