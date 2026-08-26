import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { useLogout } from '@/features/auth/hooks';
import { useGlobalSearch } from '@/features/search/useGlobalSearch';
import type { SearchResult } from '@/features/search/useGlobalSearch';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import {
  MenuIcon,
  SearchIcon,
  LogOutIcon,
  UserIcon,
  ChevronDownIcon,
  FolderKanbanIcon,
  CheckCircleIcon,
  FolderIcon,
} from '@/components/ui/Icons';

const CATEGORY_LABEL_KEY: Record<SearchResult['category'], string> = {
  project: 'project',
  task: 'task',
  member: 'member',
  folder: 'folder',
};

const CATEGORY_ICON: Record<SearchResult['category'], typeof FolderKanbanIcon> = {
  project: FolderKanbanIcon,
  task: CheckCircleIcon,
  member: UserIcon,
  folder: FolderIcon,
};

function GlobalSearchBox() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const { query, results, isLoading } = useGlobalSearch(input, hasInteracted);
  const open = isFocused && input.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsFocused(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFocused(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const goTo = (result: SearchResult) => {
    navigate(result.href);
    setInput('');
    setIsFocused(false);
  };

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={() => {
          setIsFocused(true);
          setHasInteracted(true);
        }}
        placeholder={t('common:search.placeholder')}
        aria-label={t('common:search.placeholder')}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="global-search-listbox"
        className="h-9 w-full rounded-xl border border-slate-200/80 bg-slate-100/70 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 transition-all hover:bg-slate-100 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-xs"
      />
      {open && (
        <div
          id="global-search-listbox"
          role="listbox"
          aria-live="polite"
          className="absolute left-0 right-0 z-40 mt-2 max-h-96 animate-slide-up overflow-y-auto rounded-xl border border-slate-200/90 bg-white/95 py-2 shadow-2xl shadow-slate-300/60 ring-1 ring-slate-900/5 backdrop-blur-md transition-all duration-200"
        >
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-primary-600 animate-fade-in">
              <Spinner size="sm" />
              <span className="ml-2 text-xs font-medium text-slate-400">Đang tìm kiếm...</span>
            </div>
          )}
          {!isLoading && results.length === 0 && (
            <div className="px-4 py-8 text-center animate-fade-in">
              <p className="text-sm font-medium text-slate-700">{t('common:search.noResults', { query })}</p>
              <p className="mt-1 text-xs text-slate-400">{t('common:search.noResultsHint')}</p>
            </div>
          )}
          {!isLoading &&
            results.length > 0 &&
            (['project', 'task', 'member', 'folder'] as const).map((category) => {
              const items = results.filter((r) => r.category === category);
              if (items.length === 0) return null;
              const Icon = CATEGORY_ICON[category];
              return (
                <div key={category} className="py-1">
                  <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t(`common:search.categories.${CATEGORY_LABEL_KEY[category]}`)}</span>
                    <span className="ml-auto text-[10px] text-slate-300">({items.length})</span>
                  </div>
                  {items.map((item) => (
                    <button
                      key={`${item.category}-${item.id}`}
                      type="button"
                      onClick={() => goTo(item)}
                      className="group flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-all duration-150 hover:bg-primary-50/70 hover:pl-4 cursor-pointer"
                    >
                      <span className="truncate font-medium text-slate-700 group-hover:text-primary-700">
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span className="ml-2 shrink-0 text-xs text-slate-400 group-hover:text-primary-500/80">
                          {item.sublabel}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 md:gap-5 border-b border-slate-200 bg-white px-4 md:px-6">
      {/* Nút menu mở Mobile Sidebar */}
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label={t('common:topbar.openMenu')}
        className="flex h-9 w-9 items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden shrink-0 cursor-pointer"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {/* Cụm Logo & Tên nền tảng chuyển sang Topbar bên trái */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-xs font-bold text-white shadow-sm shadow-primary-500/20">
          EFS
        </span>
        <div className="hidden sm:flex flex-col">
          <span className="text-sm font-bold tracking-tight text-slate-900 leading-none">
            ECAP for SMEs
          </span>
          <span className="text-[10px] font-medium text-slate-400 leading-tight mt-0.5">
            Enterprise Platform
          </span>
        </div>
      </div>

      {/* Thanh tìm kiếm mở rộng (fill) toàn bộ khoảng trống từ cụm thương hiệu đến cụm tiện ích bên phải */}
      <GlobalSearchBox />

      {/* Cụm tiện ích hệ thống bên phải (Chọn ngôn ngữ, Thông báo, Menu tài khoản) */}
      <div className="flex items-center gap-1.5 shrink-0">
        <LanguageSwitcher />
        <NotificationBell />

        <Dropdown
          align="right"
          panelClassName="w-56"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-label={t('common:topbar.accountMenu')}
              className="flex items-center gap-2 rounded-lg p-1.5 pr-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            >
              <Avatar name={user?.fullName} size="sm" />
              <span className="hidden max-w-[8rem] truncate text-sm font-medium text-slate-800 md:inline">{user?.fullName}</span>
              <ChevronDownIcon className="hidden h-3.5 w-3.5 text-slate-400 md:inline" />
            </button>
          )}
        >
          {({ close }) => (
            <div className="py-1.5">
              <div className="border-b border-slate-100 px-3.5 py-2.5">
                <p className="truncate text-sm font-semibold text-slate-900">{user?.fullName}</p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
                {user?.roles && user.roles.length > 0 && (
                  <p className="mt-1 truncate text-[11px] text-slate-400">{user.roles.map((r) => r.name).join(', ')}</p>
                )}
              </div>
              <DropdownItem
                onClick={() => {
                  navigate('/profile');
                  close();
                }}
              >
                <UserIcon className="h-4 w-4" /> {t('common:topbar.profile')}
              </DropdownItem>
              <DropdownItem onClick={() => logout.mutate()} className="text-rose-600 hover:bg-rose-50">
                <LogOutIcon className="h-4 w-4" /> {t('common:topbar.logout')}
              </DropdownItem>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
