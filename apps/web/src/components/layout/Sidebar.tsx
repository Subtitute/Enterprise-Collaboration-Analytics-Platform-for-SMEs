import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn, canAccessAdminArea } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';
import { LayersIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/Icons';
import { useUIStore } from '@/stores/ui.store';
import { usePermissions } from '@/stores/auth.store';
import { useUnreadMessagesCount } from '@/features/messaging/hooks';

interface SidebarContentProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

function SidebarLinks({ collapsed, onNavigate }: SidebarContentProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const permissions = usePermissions();
  const canSeeAdmin = canAccessAdminArea(permissions);
  const items = NAV_ITEMS.filter(
    (item) => (!item.adminOnly || canSeeAdmin) && (!item.requiredPermission || permissions.includes(item.requiredPermission)),
  );
  // 28/09/2026: badge so tin nhan chua doc tren muc "Nhan tin" - hien tren MOI trang (Sidebar luon
  // mount), mirror NotificationBell o Topbar. Goi useConversationsQuery() gian tiep qua day nen
  // GET /conversations duoc fetch ngay ca khi chua vao trang Nhan tin (chap nhan duoc, cung danh
  // doi voi useUnreadNotificationsPreview() da co san).
  const unreadMessagesCount = useUnreadMessagesCount();

  return (
    <nav className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-2.5 py-2">
      {items.map((item) => {
        // Kiểm tra trạng thái đang được chọn (Active)
        // 03/10/2026: mục "Trang chủ" active khi path khớp BẤT KỲ route nào trong nhóm
        // (matchPrefixes - Dashboard/Dự án/Tài liệu/Khách hàng), không chỉ path /dashboard.
        // Đối với mục Quản trị (/admin/members), nếu đang ở bất kỳ tab nào của /admin/*
        // (như /admin/departments, /admin/roles, /admin/failed-events) thì vẫn giữ active style
        const isItemActive = item.matchPrefixes
          ? item.matchPrefixes.some((prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`))
          : item.to === '/admin/members'
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
                'group relative flex h-10 items-center rounded-lg px-2.5 text-sm font-medium transition-colors duration-150',
                isItemActive
                  ? 'bg-primary-50/80 text-primary-700 font-semibold shadow-sm shadow-primary-500/5'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            {() => (
              <>
                {isItemActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-primary-600 animate-fade-in" />
                )}
                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <item.icon
                    className={cn(
                      'h-5 w-5 transition-colors duration-150',
                      isItemActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600',
                    )}
                  />
                  {item.to === '/messages' && unreadMessagesCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-primary-600 px-0.5 text-[9px] font-semibold text-white ring-2 ring-white">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-150 ease-in-out whitespace-nowrap ml-3',
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
    </nav>
  );
}

/** 03/10/2026: bo prop onToggle - rail chinh khong con nut thu gon/mo rong thu cong (toan bo panel
 *  mo rong khi hover, xem Sidebar()), chi con 1 the Link duy nhat (logo + ten, nhan chu tu mo/thu
 *  theo "collapsed" bang transition giong SidebarLinks ben tren thay vi 2 nhanh render rieng biet. */
function SidebarHeader({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const toggle = useUIStore((s) => s.toggleSidebarCollapsed);

  return (
    <div
      className={cn(
        'border-b border-slate-100 flex h-14 items-center justify-between overflow-hidden px-3.5 transition-all duration-200',
        collapsed && 'justify-center px-2',
      )}
    >
      <Link
        to="/"
        onClick={onNavigate}
        aria-label="ECAP for SMEs"
        title="ECAP for SMEs"
        className="flex items-center rounded-lg p-1 transition-colors hover:bg-slate-50 cursor-pointer overflow-hidden min-w-0"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
          <LayersIcon className="w-4 h-4 text-white" />
        </span>
        <div
          className={cn(
            'overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out',
            collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[140px] opacity-100 ml-2.5',
          )}
        >
          <span className="block truncate text-sm font-bold text-slate-900 tracking-tight">ECAP for SMEs</span>
        </div>
      </Link>

      {!collapsed && (
        <button
          type="button"
          onClick={toggle}
          title="Thu gọn menu"
          aria-label="Thu gọn menu"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Sidebar kieu ClickUp: Thu/Mo day noi dung that (khong de len, khong che noi dung), co nut thu gon/mo rong */
export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebarCollapsed);

  return (
    <aside
      className={cn(
        'sticky top-0 z-20 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ease-in-out md:flex',
        collapsed ? 'w-[68px]' : 'w-60',
      )}
    >
      <SidebarHeader collapsed={collapsed} />
      <SidebarLinks collapsed={collapsed} />

      {collapsed && (
        <div className="border-t border-slate-100 p-2 text-center">
          <button
            type="button"
            onClick={toggle}
            title="Mở rộng menu"
            aria-label="Mở rộng menu"
            className="flex h-8 w-full items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}
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
