import { useEffect, useRef } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn, canAccessAdminArea } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';
import { ChevronLeftIcon, ChevronRightIcon, BrandLogoIcon } from '@/components/ui/Icons';
import { useUIStore } from '@/stores/ui.store';
import { usePermissions, useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/ui/Avatar';
import type { NavGroup } from './nav-items';

interface SidebarContentProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

const GROUPS_ORDER: NavGroup[] = ['overview', 'workspace', 'hrm', 'insights'];

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const user = useAuthStore((s) => s.user);

  return (
    <div className={cn('border-t border-[#E5E7EB] p-2.5', collapsed ? 'flex justify-center' : 'flex items-center gap-2.5')}>
      <Link to="/profile" className="flex items-center gap-2.5 min-w-0 group hover:opacity-80 transition-opacity" title={user?.fullName || 'Tài khoản'}>
        <Avatar name={user?.fullName} size="sm" className="h-8 w-8 shrink-0 ring-1 ring-slate-200" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[#374151] group-hover:text-[#1E3A8A]">
              {user?.fullName || 'Người dùng'}
            </p>
            <p className="truncate text-[11px] text-[#9CA3AF]">
              {user?.roles?.[0]?.name || user?.email || ''}
            </p>
          </div>
        )}
      </Link>
    </div>
  );
}

function SidebarLinks({ collapsed, onNavigate }: SidebarContentProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const permissions = usePermissions();
  const canSeeAdmin = canAccessAdminArea(permissions);
  const items = NAV_ITEMS.filter(
    (item) => (!item.adminOnly || canSeeAdmin) && (!item.requiredPermission || permissions.includes(item.requiredPermission)),
  );

  return (
    <nav className="flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-2.5 py-3">
      {GROUPS_ORDER.map((groupKey) => {
        const groupItems = items.filter((i) => i.group === groupKey);
        if (groupItems.length === 0) return null;

        return (
          <div key={groupKey} className="space-y-1">
            {!collapsed && (
              <div className="px-2 pt-1 pb-1 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] select-none">
                {t(`common:nav.groups.${groupKey}`)}
              </div>
            )}
            {groupItems.map((item) => {
              const isItemActive =
                item.to === '/admin/members'
                  ? location.pathname.startsWith('/admin')
                  : location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(`${item.to}/`));

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  title={collapsed ? t(item.labelKey) : undefined}
                  aria-label={t(item.labelKey)}
                  className={() =>
                    cn(
                      'group relative flex h-8 items-center rounded-md px-2 text-xs font-medium transition-colors duration-150',
                      isItemActive
                        ? 'bg-[#EFF6FF] text-[#1E3A8A] font-semibold border-l-[3px] border-[#1E3A8A] rounded-l-none'
                        : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151]',
                    )
                  }
                >
                  {() => (
                    <>
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                        <item.icon
                          className={cn(
                            'h-4 w-4 transition-colors duration-150',
                            isItemActive ? 'text-[#1E3A8A] stroke-[2.2]' : 'text-[#6B7280] group-hover:text-[#374151]',
                          )}
                        />
                      </div>
                      <div
                        className={cn(
                          'overflow-hidden transition-all duration-150 ease-in-out whitespace-nowrap ml-2.5',
                          collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[160px] opacity-100',
                        )}
                      >
                        <span className="block truncate">{t(item.labelKey)}</span>
                      </div>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        );
      })}
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
  const toggleLabel = t(collapsed ? 'common:sidebar.expand' : 'common:sidebar.collapse');

  return (
    <div
      className={cn(
        'border-b border-slate-100 flex h-14 items-center overflow-hidden transition-all duration-150',
        collapsed ? 'justify-center px-2' : 'justify-between px-3.5',
      )}
    >
      {!collapsed ? (
        <>
          <Link
            to="/"
            onClick={onNavigate}
            aria-label="ECAP"
            title="ECAP"
            className="flex items-center rounded-lg p-1 transition-colors hover:bg-slate-50 cursor-pointer overflow-hidden min-w-0"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1E3A8A] text-white shadow-xs transition-transform duration-150 group-hover:scale-105">
              <BrandLogoIcon className="w-4 h-4 text-white" />
            </span>
            <div className="overflow-hidden whitespace-nowrap ml-2.5 max-w-[130px]">
              <span className="block truncate text-base font-bold text-[#1E3A8A] tracking-wider font-heading">
                ECAP
              </span>
            </div>
          </Link>

          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              title={toggleLabel}
              aria-label={toggleLabel}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
          )}
        </>
      ) : (
        onToggle && (
          <button
            type="button"
            onClick={onToggle}
            title={toggleLabel}
            aria-label={toggleLabel}
            className="group relative flex h-9 w-9 items-center justify-center rounded-md transition-all duration-150 cursor-pointer focus:outline-none"
          >
            {/* Logo nền tảng mặc định luôn hiển thị rõ ràng */}
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1E3A8A] text-white shadow-xs transition-opacity duration-150 group-hover:opacity-0">
              <BrandLogoIcon className="w-4 h-4 text-white" />
            </span>
            {/* Khi di chuột vào, chuyển thành nút mũi tên mở rộng trực quan */}
            <span className="absolute inset-0 flex items-center justify-center rounded-md bg-slate-100 text-primary-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100 shadow-2xs">
              <ChevronRightIcon className="w-5 h-5" />
            </span>
          </button>
        )
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
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[#E5E7EB] bg-slate-50/60 md:flex transition-[width] duration-150 ease-in-out',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      <SidebarHeader collapsed={collapsed} onToggle={toggle} />
      <SidebarLinks collapsed={collapsed} />
      <SidebarFooter collapsed={collapsed} />
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
        <SidebarFooter collapsed={false} />
      </div>
    </div>
  );
}
