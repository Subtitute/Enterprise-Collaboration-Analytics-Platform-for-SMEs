import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { getBreadcrumbs } from '@/lib/breadcrumbs';
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
import { ConfirmDialog } from '@/components/ui/Modal';
import { QuickCreateTaskModal } from '@/features/projects/components/QuickCreateTaskModal';
import { cn } from '@/lib/utils';
import {
  MenuIcon,
  PanelLeftIcon,
  SearchIcon,
  LogOutIcon,
  UserIcon,
  ChevronDownIcon,
  FolderKanbanIcon,
  CheckCircleIcon,
  FolderIcon,
  PlusIcon,
  CalendarIcon,
  BriefcaseIcon,
  SettingsIcon,
  XIcon,
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const { query, results, isLoading } = useGlobalSearch(input, hasInteracted);
  const open = isFocused && input.trim().length > 0;

  // Phát hiện hệ điều hành để hiển thị phím tắt ⌘K (macOS) hoặc Ctrl K (Windows/Linux) (§4.3)
  const isMac = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  }, []);
  const kbdShortcut = isMac ? '⌘K' : 'Ctrl K';

  // Lắng nghe phím tắt toàn cục ⌘K / Ctrl K để focus vào ô tìm kiếm
  useEffect(() => {
    const handleGlobalKbd = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKbd);
    return () => window.removeEventListener('keydown', handleGlobalKbd);
  }, []);

  useEffect(() => {
    if (!open) {
      setSelectedIndex(-1);
      return;
    }
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const goTo = (result: SearchResult) => {
    navigate(result.href);
    setInput('');
    setIsFocused(false);
  };

  // Điều hướng phím mũi tên ↑ ↓, Enter chọn, Esc đóng (§4.4)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') {
        setIsFocused(false);
        inputRef.current?.blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        goTo(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={rootRef} className="relative w-full max-w-[440px]">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
      <input
        ref={inputRef}
        type="search"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setSelectedIndex(-1);
        }}
        onFocus={() => {
          setIsFocused(true);
          setHasInteracted(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={t('common:search.placeholder', 'Tìm kiếm dự án, tài liệu, công việc...')}
        aria-label={t('common:search.placeholder', 'Tìm kiếm dự án, tài liệu, công việc...')}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="global-search-listbox"
        aria-activedescendant={selectedIndex >= 0 && results[selectedIndex] ? `search-opt-${results[selectedIndex].category}-${results[selectedIndex].id}` : undefined}
        className="h-8 w-full rounded-radius-sm border border-transparent bg-bg-subtle pl-8 pr-16 text-sm text-text-primary placeholder:text-text-tertiary transition-colors hover:border-border-subtle focus:border-accent focus:bg-bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent-soft"
      />

      {/* KBD Hint (§4.3): Chỉ hiển thị khi input rỗng và chưa focus */}
      {!isFocused && input.length === 0 && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[3px] border border-border-subtle bg-bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-text-tertiary select-none">
          {kbdShortcut}
        </span>
      )}

      {/* Nút Clear văn bản chuẩn Design System v0.4 khi có nội dung nhập */}
      {input.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setInput('');
            setSelectedIndex(-1);
            inputRef.current?.focus();
          }}
          title={t('common:clear', 'Xóa')}
          aria-label={t('common:clear', 'Xóa')}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-text-tertiary hover:bg-bg-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <XIcon className="h-3 w-3 stroke-[2.2]" />
        </button>
      )}


      {/* Dropdown kết quả tìm kiếm (§4.4) */}
      {open && (
        <div
          id="global-search-listbox"
          role="listbox"
          aria-live="polite"
          className="absolute left-0 right-0 z-40 mt-1 max-h-96 overflow-y-auto rounded-radius-md border border-border-subtle bg-bg-surface p-1 shadow-md"
        >
          {isLoading && (
            <div className="flex items-center justify-center py-6 text-accent">
              <Spinner size="sm" />
              <span className="ml-2 text-xs font-medium text-text-secondary">{t('common:search.loading', 'Đang tìm kiếm...')}</span>
            </div>
          )}

          {!isLoading && results.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-[13px] leading-5 text-text-secondary">
                {t('common:search.noResults', { query: input, defaultValue: `Không tìm thấy kết quả cho "${input}"` })}
              </p>
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
                  <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                    <span>{t(`common:search.category.${category}`, CATEGORY_LABEL_KEY[category])}</span>
                  </div>
                  {items.map((item) => {
                    const itemGlobalIndex = results.indexOf(item);
                    const isSelected = itemGlobalIndex === selectedIndex;
                    const optId = `search-opt-${item.category}-${item.id}`;
                    return (
                      <button
                        key={`${item.category}-${item.id}`}
                        id={optId}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => goTo(item)}
                        onMouseEnter={() => setSelectedIndex(itemGlobalIndex)}
                        className={cn(
                          'flex h-10 w-full items-center gap-2.5 rounded-radius-sm px-2.5 py-2 text-left transition-colors cursor-pointer',
                          isSelected ? 'bg-bg-subtle text-text-primary' : 'hover:bg-bg-subtle text-text-secondary',
                        )}
                      >

                        <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
                        <span className="truncate text-[13px] font-medium text-text-primary flex-1">
                          {item.label}
                        </span>
                        {item.sublabel && (
                          <span className="shrink-0 text-xs text-text-tertiary">
                            {item.sublabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const toggleSidebarCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);

  // Nhận diện projectId nếu người dùng đang xem chi tiết một dự án cụ thể (/projects/:projectId)
  const currentProjectId = useMemo(() => {
    const match = location.pathname.match(/^\/projects\/([^/]+)/);
    return match ? match[1] : undefined;
  }, [location.pathname]);

  // Phân quyền hiển thị: Admin hoặc Manager có thêm quyền tạo Dự án & Khách hàng
  const canManageProjectsOrCRM = useMemo(() => {
    if (!user?.roles || user.roles.length === 0) return false;
    return user.roles.some((r) => {
      const name = r.name.toLowerCase();
      return name.includes('admin') || name.includes('manager');
    });
  }, [user?.roles]);

  // Phím tắt toàn cục: Bấm 'c' hoặc 'C' để mở nhanh modal tạo Task khi không focus vào ô nhập liệu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const activeEl = document.activeElement;
        const tagName = activeEl?.tagName.toLowerCase();
        const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || (activeEl as HTMLElement)?.isContentEditable;
        if (!isInput && !showQuickTaskModal && !showLogoutConfirm) {
          e.preventDefault();
          setShowQuickTaskModal(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQuickTaskModal, showLogoutConfirm]);

  // Tự động sinh danh sách breadcrumb từ route React Router (§3.2)
  const breadcrumbs = useMemo(() => getBreadcrumbs(location.pathname), [location.pathname, i18n.language]);
  const currentPageTitle = breadcrumbs[breadcrumbs.length - 1]?.label || t('common:nav.homeNav.overview', 'Tổng quan');

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-4 md:px-5">
      {/* =========================================================================
          VÙNG TRÁI: Toggle Sidebar + Breadcrumb (§3)
          ========================================================================= */}
      <div className="flex items-center gap-3 shrink-0 min-w-0 max-w-[45%]">
        {/* Toggle Sidebar (32x32) */}
        <button
          type="button"
          onClick={() => {
            if (window.innerWidth < 768) {
              setMobileSidebarOpen(true);
            } else {
              toggleSidebarCollapsed();
            }
          }}
          title={t('common:topbar.toggleTooltip', 'Ẩn/Hiện thanh điều hướng')}
          aria-label={t('common:topbar.toggleTooltip', 'Ẩn/Hiện thanh điều hướng')}
          className="flex h-8 w-8 items-center justify-center rounded-radius-sm text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer shrink-0"
        >
          <span className="md:hidden">
            <MenuIcon className="h-[18px] w-[18px]" />
          </span>
          <span className="hidden md:inline-flex">
            <PanelLeftIcon className="h-[18px] w-[18px]" />
          </span>
        </button>

        {/* Mobile: Chỉ hiển thị page title hiện tại (1 dòng, truncate) */}
        <span className="md:hidden truncate text-sm font-semibold text-text-primary">
          {currentPageTitle}
        </span>

        {/* Desktop: Breadcrumb đầy đủ, auto-generate từ pathname */}
        <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-[13px] leading-5 text-text-tertiary min-w-0 truncate">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <span key={`${crumb.label}-${idx}`} className="inline-flex items-center gap-1.5 min-w-0">
                {idx > 0 && <span className="text-text-tertiary select-none">/</span>}
                {isLast ? (
                  <span className="truncate font-medium text-text-primary" aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.href || '#'}
                    className="truncate hover:text-text-primary transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      {/* =========================================================================
          VÙNG GIỮA: Global Search Box max-w-[440px] (§4)
          ========================================================================= */}
      <div className="hidden sm:flex flex-1 max-w-[440px] mx-4 justify-center min-w-0">
        <GlobalSearchBox />
      </div>

      {/* =========================================================================
          VÙNG PHẢI: Quick Create + Notification Bell + User Profile (§5)
          ========================================================================= */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Nút Tạo mới: Nền INK #1C1B1A, height 32, radius 6px (§5.1, §6) */}
        <Dropdown
          align="right"
          panelClassName="w-64 p-1 rounded-radius-md border border-border-subtle bg-bg-surface shadow-md"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              title={t('common:quickCreate.tooltip', 'Tạo mới (Phím tắt: C)')}
              aria-label={t('common:quickCreate.tooltip', 'Tạo mới (Phím tắt: C)')}
              className="inline-flex h-8 items-center gap-1.5 rounded-radius-md bg-[#1C1B1A] px-3 text-[13px] font-medium text-white hover:bg-[#2E2C29] active:bg-[#141312] transition-colors cursor-pointer select-none"
            >
              <PlusIcon className="h-3.5 w-3.5 stroke-[2.2] text-white" />
              <span className="hidden md:inline text-white">{t('common:quickCreate.button', 'Tạo mới')}</span>
              <ChevronDownIcon
                className={cn('hidden md:inline h-3 w-3 text-[#8A8781] transition-transform duration-200', open && 'rotate-180')}
              />
            </button>
          )}
        >
          {({ close }) => (
            <div className="py-1">
              {/* Nhóm 1: Công việc (§6.1) */}
              <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                {t('common:quickCreate.groupTasks', 'Công việc')}
              </div>
              <DropdownItem
                onClick={() => {
                  close();
                  setShowQuickTaskModal(true);
                }}
                className="flex items-center justify-between gap-2.5 rounded-radius-sm px-2.5 py-2 hover:bg-bg-subtle transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-text-secondary" />
                  <span className="text-[13px] font-medium text-text-primary truncate">
                    {t('common:quickCreate.createTask', 'Tạo công việc')}
                  </span>
                </div>
                <span className="pointer-events-none rounded-[3px] border border-border-subtle bg-bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-text-tertiary">
                  C
                </span>
              </DropdownItem>

              {/* Nhóm 2: Khác (§6.1, §6.3 phân quyền role) */}
              <div className="mt-2 border-t border-border-subtle pt-1.5">
                <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                  {t('common:quickCreate.groupOthers', 'Khác')}
                </div>

                {/* Tạo dự án mới — Quản lý & Admin (§6.3) */}
                {canManageProjectsOrCRM && (
                  <DropdownItem
                    onClick={() => {
                      close();
                      navigate('/projects?action=create');
                    }}
                    className="flex items-center gap-2.5 rounded-radius-sm px-2.5 py-2 hover:bg-bg-subtle transition-colors"
                  >
                    <FolderKanbanIcon className="h-4 w-4 shrink-0 text-text-secondary" />
                    <span className="text-[13px] font-medium text-text-primary truncate">
                      {t('common:quickCreate.createProject', 'Tạo dự án mới')}
                    </span>
                  </DropdownItem>
                )}

                {/* Thêm khách hàng — Quản lý & Admin (§6.3) */}
                {canManageProjectsOrCRM && (
                  <DropdownItem
                    onClick={() => {
                      close();
                      navigate('/customers?action=create');
                    }}
                    className="flex items-center gap-2.5 rounded-radius-sm px-2.5 py-2 hover:bg-bg-subtle transition-colors"
                  >
                    <BriefcaseIcon className="h-4 w-4 shrink-0 text-text-secondary" />
                    <span className="text-[13px] font-medium text-text-primary truncate">
                      {t('common:quickCreate.createCustomer', 'Thêm khách hàng')}
                    </span>
                  </DropdownItem>
                )}

                {/* Gửi đơn nghỉ phép — Mọi role (§6.3) */}
                <DropdownItem
                  onClick={() => {
                    close();
                    navigate('/leave-requests?action=create');
                  }}
                  className="flex items-center gap-2.5 rounded-radius-sm px-2.5 py-2 hover:bg-bg-subtle transition-colors"
                >
                  <CalendarIcon className="h-4 w-4 shrink-0 text-text-secondary" />
                  <span className="text-[13px] font-medium text-text-primary truncate">
                    {t('common:quickCreate.requestLeave', 'Gửi đơn nghỉ phép')}
                  </span>
                </DropdownItem>
              </div>
            </div>
          )}
        </Dropdown>

        {/* Chuông thông báo (32x32, badge đỏ #B3261E) (§5.2) */}
        <NotificationBell />

        {/* Language Switcher 🌐 VI ▾ (32px, ghost button) */}
        <LanguageSwitcher />

        {/* User Profile trigger & dropdown (§5.3, §7) */}
        <Dropdown
          align="right"
          panelClassName="w-64 p-1 rounded-radius-md border border-border-subtle bg-bg-surface shadow-md"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-label={t('common:topbar.accountMenu', 'Menu tài khoản')}
              className={cn(
                'flex h-8 items-center gap-2 rounded-radius-sm p-1 pr-2 text-text-secondary hover:bg-bg-subtle transition-colors cursor-pointer',
                open && 'bg-bg-subtle text-text-primary',
              )}
            >
              <Avatar name={user?.fullName} size="sm" className="h-6 w-6 text-[10px] bg-[#0E5E5E] text-white" />
              <span className="hidden max-w-[140px] truncate text-[13px] font-medium text-text-primary md:inline">
                {user?.fullName}
              </span>
              <ChevronDownIcon
                className={cn('hidden h-3 w-3 text-text-tertiary transition-transform duration-200 md:inline', open && 'rotate-180')}
              />
            </button>
          )}
        >
          {({ close }) => (
            <div className="py-1">
              {/* Header User Menu (§7.1) */}
              <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border-subtle">
                <Avatar name={user?.fullName} size="md" className="h-10 w-10 text-xs shrink-0 bg-[#0E5E5E] text-white font-semibold" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text-primary">
                    {user?.fullName}
                  </p>
                  <p className="truncate text-xs text-text-tertiary">
                    {user?.email}
                  </p>
                  {user?.roles && user.roles.length > 0 && (
                    <span className="mt-1 inline-block rounded-[3px] bg-bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                      {user.roles[0].name}
                    </span>
                  )}
                </div>
              </div>

              {/* Section Navigation (§7.2) */}
              <div className="py-1">
                <DropdownItem
                  onClick={() => {
                    close();
                    navigate('/profile');
                  }}
                  className="flex items-center gap-2.5 rounded-radius-sm px-2.5 py-2 hover:bg-bg-subtle transition-colors"
                >
                  <UserIcon className="h-4 w-4 shrink-0 text-text-secondary" />
                  <span className="text-[13px] font-medium text-text-primary">
                    {t('common:topbar.profile', 'Hồ sơ cá nhân')}
                  </span>
                </DropdownItem>

                <DropdownItem
                  onClick={() => {
                    close();
                    navigate('/settings');
                  }}
                  className="flex items-center gap-2.5 rounded-radius-sm px-2.5 py-2 hover:bg-bg-subtle transition-colors"
                >
                  <SettingsIcon className="h-4 w-4 shrink-0 text-text-secondary" />
                  <span className="text-[13px] font-medium text-text-primary">
                    {t('common:topbar.settings', 'Cài đặt')}
                  </span>
                </DropdownItem>
              </div>

              {/* Section Logout (§7.4) */}
              <div className="border-t border-border-subtle pt-1">
                <DropdownItem
                  onClick={() => {
                    close();
                    setShowLogoutConfirm(true);
                  }}
                  className="flex items-center gap-2.5 rounded-radius-sm px-2.5 py-2 text-[#B3261E] hover:bg-rose-50/60 transition-colors"
                >
                  <LogOutIcon className="h-4 w-4 shrink-0 text-[#B3261E]" />
                  <span className="text-[13px] font-medium text-[#B3261E]">
                    {t('common:topbar.logout', 'Đăng xuất')}
                  </span>
                </DropdownItem>
              </div>
            </div>
          )}
        </Dropdown>
      </div>

      {/* Modal tạo công việc nhanh (Quick Create Task) */}
      <QuickCreateTaskModal
        open={showQuickTaskModal}
        onClose={() => setShowQuickTaskModal(false)}
        defaultProjectId={currentProjectId}
      />

      {/* Modal xác nhận đăng xuất chống bấm nhầm (§7.5: focus mặc định Hủy) */}
      <ConfirmDialog
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout.mutate();
        }}
        title={t('common:topbar.logoutConfirmTitle', 'Xác nhận đăng xuất')}
        description={t('common:topbar.logoutConfirmDescription', 'Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc hiện tại không?')}
        confirmLabel={t('common:topbar.logout', 'Đăng xuất')}
        cancelLabel={t('common:actions.cancel', 'Hủy')}
        danger
        isLoading={logout.isPending}
      />
    </header>
  );
}

