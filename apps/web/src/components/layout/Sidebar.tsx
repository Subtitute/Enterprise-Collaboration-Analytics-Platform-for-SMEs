import { NavLink } from 'react-router-dom';
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
  const roles = useAuthStore((s) => s.user?.roles);
  const canSeeAdmin = hasAdminRole(roles);
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || canSeeAdmin);

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              collapsed && 'justify-center px-0',
              isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-primary-600' : 'text-slate-400')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn('flex h-14 shrink-0 items-center gap-2 border-b border-slate-100 px-4', collapsed && 'justify-center px-0')}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">EC</span>
      {!collapsed && <span className="truncate text-sm font-semibold text-slate-900">ECAP for SMEs</span>}
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
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 md:flex',
        collapsed ? 'w-[68px]' : 'w-60',
      )}
    >
      <Logo collapsed={collapsed} />
      <SidebarLinks collapsed={collapsed} />
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        className="flex h-11 shrink-0 items-center justify-center gap-2 border-t border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      >
        {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
      </button>
    </aside>
  );
}

/** Ngan keo (drawer) cho man hinh mobile, mo bang nut hamburger tren Topbar. */
export function MobileSidebar() {
  const open = useUIStore((s) => s.mobileSidebarOpen);
  const setOpen = useUIStore((s) => s.setMobileSidebarOpen);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={() => setOpen(false)} aria-hidden />
      <div className="relative z-10 flex h-full w-72 max-w-[80vw] animate-slide-up flex-col bg-white shadow-xl">
        <Logo collapsed={false} />
        <SidebarLinks collapsed={false} onNavigate={() => setOpen(false)} />
      </div>
    </div>
  );
}
