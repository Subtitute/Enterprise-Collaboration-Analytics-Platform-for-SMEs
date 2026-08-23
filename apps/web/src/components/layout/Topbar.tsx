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
  // 22/07/2026: hasInteracted CHI duoc bat (true) va khong bao gio tat lai - dung lam cong "1
  // chieu" de useGlobalSearch() tri hoan 4 query toan to chuc toi lan focus DAU TIEN vao o tim
  // kiem nay, tranh goi lai vo dieu kien moi khi Topbar mount o cac trang khong lien quan tim
  // kiem (xem chu thich day du tai useGlobalSearch.ts).
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
    <div ref={rootRef} className="relative hidden max-w-sm flex-1 sm:block">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        // 22/07/2026: xem chu thich hasInteracted o tren - chi can set 1 lan, khong can dieu kien.
        onFocus={() => {
          setIsFocused(true);
          setHasInteracted(true);
        }}
        placeholder={t('common:search.placeholder')}
        // 28/07/2026: them aria-label khop voi placeholder + cac thuoc tinh ARIA combobox/listbox
        // (phat hien qua ra soat kha nang tiep can) - placeholder bien mat khi go chu va khong dam
        // bao duoc dung lam ten truy cap; o nhap nay con dieu khien 1 hop ket qua dang mo/dong nhung
        // truoc do khong co ngu nghia combobox nao de trinh doc man hinh biet co danh sach lien quan.
        // Chi bo sung ngu nghia ARIA, KHONG doi hanh vi/dieu huong ban phim hien co (dieu huong bang
        // mui ten trong danh sach ket qua nam ngoai pham vi lan sua nay).
        aria-label={t('common:search.placeholder')}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="global-search-listbox"
        className="h-9 w-full rounded-lg border border-slate-200/80 bg-slate-100/80 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 transition-colors hover:bg-slate-100 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      {open && (
        // 28/07/2026: them role="listbox" + id (khop aria-controls tren input) + aria-live="polite"
        // (phat hien qua ra soat kha nang tiep can) - bo sung ngu nghia listbox cho vung ket qua nay
        // va bao trinh doc man hinh khi noi dung ben trong thay doi (dang tai, "khong tim thay ket
        // qua", hoac danh sach ket qua moi xuat hien) ma khong can nguoi dung phai tu di tim lai.
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
              <p className="mt-1 text-xs text-slate-400">Thử tìm kiếm với từ khóa khác</p>
            </div>
          )}
          {!isLoading &&
            results.length > 0 &&
            (['project', 'task', 'member', 'folder'] as const).map((category) => {
              const items = results.filter((r) => r.category === category);
              if (items.length === 0) return null;
              const Icon = CATEGORY_ICON[category];
              return (
                <div key={category} className="py-1 animate-fade-in">
                  <p className="px-3.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {t(`common:search.category.${CATEGORY_LABEL_KEY[category]}`)}
                  </p>
                  {items.map((r) => (
                    <button
                      key={`${r.category}-${r.id}`}
                      type="button"
                      role="option"
                      onClick={() => goTo(r)}
                      className="group flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-all duration-150 hover:bg-primary-50/60 hover:pl-4"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-primary-100 group-hover:text-primary-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-800 group-hover:text-primary-700">{r.label}</span>
                        {r.sublabel && <span className="block truncate text-xs text-slate-400">{r.sublabel}</span>}
                      </span>
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
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label={t('common:topbar.openMenu')}
        className="flex h-9 w-9 items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <GlobalSearchBox />

      <div className="ml-auto flex items-center gap-1.5">
        <LanguageSwitcher />
        <NotificationBell />

        <Dropdown
          align="right"
          panelClassName="w-56"
          trigger={({ toggle }) => (
            // 28/07/2026: them aria-label "Menu tài khoản" - nut nay truoc do khong co nhan truy
            // cap tuong minh (chi dua vao text ten nguoi dung hien thi, an tren mobile va co the
            // doi theo tung tai khoan), gay kho khan cho ca trinh doc man hinh lan E2E test can
            // dinh vi nut on dinh khong phu thuoc du lieu dang nhap.
            <button
              type="button"
              onClick={toggle}
              aria-label={t('common:topbar.accountMenu')}
              className="flex items-center gap-2 rounded-lg p-1.5 pr-2.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Avatar name={user?.fullName} size="sm" />
              <span className="hidden max-w-[9rem] truncate text-sm font-medium text-slate-800 md:inline">{user?.fullName}</span>
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
