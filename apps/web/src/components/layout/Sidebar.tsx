import { useEffect, useRef } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn, hasAdminRole } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/Icons';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';

interface SidebarContentProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

function SidebarLinks({ collapsed, onNavigate }: SidebarContentProps) {
  const { t } = useTranslation();
  const roles = useAuthStore((s) => s.user?.roles);
  const canSeeAdmin = hasAdminRole(roles);
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || canSeeAdmin);

  return (
    <nav className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-2.5 py-2">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          title={collapsed ? t(item.labelKey) : undefined}
          // 28/07/2026: them aria-label = ten muc dieu huong (phat hien qua ra soat kha nang tiep
          // can) - truoc do khi thu gon Sidebar, ten muc chi duoc gan qua title (tooltip khi ru
          // chuot), khong dam bao duoc trinh doc man hinh dung lam ten truy cap; giu title de hien
          // tooltip cho chuot, bo sung aria-label de luon co ten truy cap on dinh du thu gon hay khong.
          aria-label={t(item.labelKey)}
          className={({ isActive }) =>
            cn(
              'group relative flex h-10 items-center rounded-lg px-2.5 text-sm font-medium transition-all duration-300 ease-out',
              isActive
                ? 'bg-primary-50/80 text-primary-700 font-semibold shadow-sm shadow-primary-500/5'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-primary-600 animate-fade-in" />
              )}
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                <item.icon
                  className={cn(
                    'h-5 w-5 transition-colors duration-300 ease-out',
                    isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600',
                  )}
                />
              </div>
              <div
                className={cn(
                  'flex-1 min-w-0 overflow-hidden transition-all duration-300 ease-out whitespace-nowrap',
                  collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[160px] opacity-100 ml-3',
                )}
              >
                <span className="block truncate">{t(item.labelKey)}</span>
              </div>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarHeader({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const orgName = user?.organizationName || 'Demo SME Platform';
  const orgInitial = orgName.trim().charAt(0).toUpperCase() || 'O';
  const toggleLabel = t(collapsed ? 'common:sidebar.expand' : 'common:sidebar.collapse');

  return (
    <div
      className={cn(
        'border-b border-slate-100 mb-2 transition-all duration-300 ease-out',
        collapsed ? 'flex flex-col items-center gap-2 py-3 px-2' : 'flex h-16 items-center justify-between px-3 pt-3 pb-3',
      )}
    >
      <Link
        to="/"
        onClick={onNavigate}
        aria-label={t('common:sidebar.orgAriaLabel', { orgName })}
        className="group flex min-w-0 items-center rounded-lg p-1 transition-colors hover:bg-slate-50 overflow-hidden"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-sm font-bold text-white shadow-sm shadow-primary-500/20 transition-transform duration-200 group-hover:scale-105">
          {orgInitial}
        </span>
        <div
          className={cn(
            'flex flex-col min-w-0 overflow-hidden transition-all duration-300 ease-out whitespace-nowrap',
            collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[130px] opacity-100 ml-2.5',
          )}
        >
          <span className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-primary-600" title={orgName}>
            {orgName}
          </span>
          <span className="truncate text-[10px] font-medium text-slate-400">{t('common:sidebar.subtitle')}</span>
        </div>
      </Link>

      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          title={toggleLabel}
          aria-label={toggleLabel}
          className={cn(
            'flex items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700',
            collapsed ? 'h-6 w-full py-0.5 text-slate-500 hover:bg-slate-100' : 'h-7 w-7 shrink-0',
          )}
        >
          {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

/** Sidebar co dinh cho man hinh md+. Tu dong thu gon o do rong tablet, co the bam nut de thu gon/mo rong thu cong. */
export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebarCollapsed);

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-300 ease-out md:flex',
        collapsed ? 'w-[68px]' : 'w-60',
      )}
    >
      {/* 26/08/2026: fix ra soat lan 4 - SidebarHeader da tu co 1 nut thu gon/mo rong rieng (dung
          chung onToggle nay); truoc do Sidebar() con rieng 1 nut thu gon/mo rong THU HAI o duoi
          cung, lam cung 1 viec voi nut cua SidebarHeader, va nut o day khong bao gio duoc phat
          hien la trung lap qua cac dot rieng ra soat i18n/accessibility (moi dot chi sua rieng le
          tung nut, khong doi chieu ca 2). Bo nut thu hai, chi giu 1 nut duy nhat o SidebarHeader. */}
      <SidebarHeader collapsed={collapsed} onToggle={toggle} />
      <SidebarLinks collapsed={collapsed} />
    </aside>
  );
}

/** Ngan keo (drawer) cho man hinh mobile, mo bang nut hamburger tren Topbar. */
export function MobileSidebar() {
  const open = useUIStore((s) => s.mobileSidebarOpen);
  const setOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const drawerRef = useRef<HTMLDivElement>(null); // 28/07/2026: xem ghi chu useEffect ben duoi.

  // 28/07/2026: bo sung dong bang phim Escape + chuyen focus vao drawer khi mo (phat hien qua ra
  // soat kha nang tiep can) - truoc do drawer nay CHI dong duoc bang cach bam vao lop nen (chuot),
  // nguoi dung ban phim khong co cach nao dong lai; ngoai ra khi mo, focus ban phim van nam o nut
  // hamburger tren Topbar (da bi drawer che khuat ve mat thi giac) thay vi chuyen vao trong drawer
  // dang hien thi. Sua bang: lang nghe keydown Escape (chi khi dang mo) de dong drawer, va focus
  // vao chinh container cua drawer ngay sau khi mo.
  useEffect(() => {
    if (!open) return;
    drawerRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={() => setOpen(false)} aria-hidden />
      <div
        ref={drawerRef}
        tabIndex={-1}
        className="relative z-10 flex h-full w-72 max-w-[80vw] animate-slide-up flex-col bg-white shadow-xl focus:outline-none"
      >
        <SidebarHeader collapsed={false} onNavigate={() => setOpen(false)} />
        <SidebarLinks collapsed={false} onNavigate={() => setOpen(false)} />
      </div>
    </div>
  );
}
