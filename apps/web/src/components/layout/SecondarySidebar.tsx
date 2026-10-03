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
    <aside className="sticky top-0 z-10 hidden h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-14 shrink-0 items-center border-b border-slate-100 px-4">
        <span className="truncate text-sm font-bold text-slate-900 tracking-tight">{t('common:nav.home')}</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-2.5 py-2">
        {HOME_SUB_NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={() =>
                cn(
                  'group relative flex h-10 items-center rounded-lg px-2.5 text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-primary-50/80 text-primary-700 font-semibold shadow-sm shadow-primary-500/5'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-primary-600 animate-fade-in" />
              )}
              <item.icon
                className={cn(
                  'h-5 w-5 shrink-0 transition-colors duration-150',
                  isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600',
                )}
              />
              <span className="ml-3 truncate">{t(item.labelKey)}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
