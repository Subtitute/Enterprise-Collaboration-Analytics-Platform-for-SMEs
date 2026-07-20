import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { useLogout } from '@/features/auth/hooks';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { MenuIcon, SearchIcon, LogOutIcon, UserIcon, ChevronDownIcon } from '@/components/ui/Icons';

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const logout = useLogout();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Mở menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <div className="relative hidden max-w-sm flex-1 sm:block">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Tìm kiếm dự án, tài liệu, công việc…"
          title="Tính năng tìm kiếm tổng hợp sẽ sớm ra mắt"
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-600 placeholder:text-slate-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <NotificationBell />

        <Dropdown
          align="right"
          panelClassName="w-56"
          trigger={({ toggle }) => (
            <button type="button" onClick={toggle} className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100">
              <Avatar name={user?.fullName} size="sm" />
              <span className="hidden max-w-[9rem] truncate text-sm font-medium text-slate-700 md:inline">{user?.fullName}</span>
              <ChevronDownIcon className="hidden h-3.5 w-3.5 text-slate-400 md:inline" />
            </button>
          )}
        >
          {() => (
            <div className="py-1.5">
              <div className="border-b border-slate-100 px-3.5 py-2.5">
                <p className="truncate text-sm font-semibold text-slate-900">{user?.fullName}</p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
                {user?.roles && user.roles.length > 0 && (
                  <p className="mt-1 truncate text-[11px] text-slate-400">{user.roles.map((r) => r.name).join(', ')}</p>
                )}
              </div>
              <DropdownItem disabled>
                <UserIcon className="h-4 w-4" /> Hồ sơ cá nhân
              </DropdownItem>
              <DropdownItem onClick={() => logout.mutate()} className="text-rose-600 hover:bg-rose-50">
                <LogOutIcon className="h-4 w-4" /> Đăng xuất
              </DropdownItem>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
