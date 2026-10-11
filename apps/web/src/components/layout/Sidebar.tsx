import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn, canAccessAdminArea } from '@/lib/utils';
import { NAV_ITEMS, HOME_ROUTE_PREFIXES, HOME_SUB_NAV_ITEMS } from './nav-items';
import { CascadeLogoIcon, ChevronDownIcon } from '@/components/ui/Icons';
import { useUIStore } from '@/stores/ui.store';
import { usePermissions } from '@/stores/auth.store';
import { useUnreadMessagesCount } from '@/features/messaging/hooks';

interface SidebarContentProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

function SidebarLinks({ collapsed, onNavigate, isMobile = false }: SidebarContentProps & { isMobile?: boolean }) {
  const { t } = useTranslation();
  const location = useLocation();
  const permissions = usePermissions();
  const canSeeAdmin = canAccessAdminArea(permissions);
  const items = NAV_ITEMS.filter(
    (item) => (!item.adminOnly || canSeeAdmin) && (!item.requiredPermission || permissions.includes(item.requiredPermission)),
  );
  const unreadMessagesCount = useUnreadMessagesCount();

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Mặc định mở accordion Trang chủ khi người dùng đang ở trong route của nhóm này
  const isCurrentlyInHome = HOME_ROUTE_PREFIXES.some(
    (prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
  );
  const [homeAccordionOpen, setHomeAccordionOpen] = useState(isCurrentlyInHome);

  // Đồng bộ mở khi chuyển route vào nhóm Trang chủ
  useEffect(() => {
    if (isCurrentlyInHome) {
      setHomeAccordionOpen(true);
    }
  }, [isCurrentlyInHome]);

  const handleMouseEnter = (key: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!collapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const top = rect.top + rect.height / 2;
    const left = rect.right + 8; // Neo ben phai icon 8px

    timerRef.current = setTimeout(() => {
      setTooltipPos({ top, left });
      setHoveredKey(key);
    }, 180); // Delay 150-200ms theo spec §4.2
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHoveredKey(null);
    setTooltipPos(null);
  };

  return (
    <nav aria-label={t('common:nav.mainAria')} className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-2 py-2">
      {items.map((item) => {
        const isHome = Boolean(item.matchPrefixes);
        const isItemActive = isHome
          ? isCurrentlyInHome
          : item.to === '/admin/members'
            ? location.pathname.startsWith('/admin')
            : location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(`${item.to}/`));

        const tooltipId = `nav-tooltip-${item.to.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const isTooltipVisible = collapsed && hoveredKey === item.to;
        const label = t(item.labelKey);

        const ariaLabel =
          item.to === '/messages' && unreadMessagesCount > 0
            ? `${label}, ${t('common:nav.unreadMessagesSuffix', { count: unreadMessagesCount })}`
            : label;

        return (
          <div key={item.to} className="relative">
            <div className="flex items-center">
              <NavLink
                to={item.to}
                onClick={(e) => {
                  if (isMobile && isHome) {
                    // Trên mobile nếu bấm vào Trang chủ, toggle accordion
                    setHomeAccordionOpen((prev) => !prev);
                  }
                  onNavigate?.();
                }}
                onMouseEnter={(e) => handleMouseEnter(item.to, e)}
                onMouseLeave={handleMouseLeave}
                aria-label={ariaLabel}
                aria-current={(!isHome && isItemActive) ? 'page' : undefined}
                aria-describedby={collapsed ? tooltipId : undefined}
                className={cn(
                  'group relative flex h-10 flex-1 items-center rounded-radius-sm px-2.5 text-[13px] font-normal transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-soft',
                  isItemActive
                    ? 'bg-accent-soft text-accent font-medium'
                    : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary',
                )}
              >
                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <item.icon
                    className={cn(
                      'h-5 w-5 transition-colors duration-150',
                      isItemActive ? 'text-accent' : 'text-text-tertiary group-hover:text-text-secondary',
                    )}
                  />
                  {/* Badge tin nhắn (§2.5): Collapsed pill 16x16 ở top-1.5 right-1.5 */}
                  {item.to === '/messages' && unreadMessagesCount > 0 && collapsed && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#B3261E] px-1 text-[10px] font-semibold text-white border-2 border-bg-surface">
                      {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-150 ease-in-out whitespace-nowrap ml-2.5 flex-1 flex items-center justify-between',
                    collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[160px] opacity-100',
                  )}
                >
                  <span className="truncate">{label}</span>
                  {item.to === '/messages' && unreadMessagesCount > 0 && !collapsed && (
                    <span className="ml-2 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-[#B3261E] px-1 text-[10px] font-semibold text-white">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </span>
                  )}
                </div>
              </NavLink>

              {/* Mũi tên toggle Accordion trên Mobile cho mục Trang chủ */}
              {isMobile && isHome && (
                <button
                  type="button"
                  onClick={() => setHomeAccordionOpen((prev) => !prev)}
                  aria-label={t('common:nav.homeAccordionExpandAria')}
                  className="flex h-10 w-9 items-center justify-center rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
                >
                  <ChevronDownIcon
                    className={cn('h-3.5 w-3.5 transition-transform duration-200', homeAccordionOpen && 'rotate-180')}
                  />
                </button>
              )}
            </div>

            {/* Accordion Sub-items lồng trực tiếp ngay bên dưới Trang chủ (Phương án A) */}
            {isMobile && isHome && homeAccordionOpen && (
              <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border-subtle pl-2.5 py-1">
                {HOME_SUB_NAV_ITEMS.map((subItem) => {
                  const isSubActive =
                    location.pathname === subItem.to || location.pathname.startsWith(`${subItem.to}/`);

                  return (
                    <NavLink
                      key={subItem.to}
                      to={subItem.to}
                      onClick={onNavigate}
                      aria-current={isSubActive ? 'page' : undefined}
                      className={() =>
                        cn(
                          'flex h-9 items-center rounded-radius-sm px-2.5 text-[13px] font-normal transition-colors duration-150',
                          isSubActive
                            ? 'bg-accent-soft text-accent font-medium'
                            : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary',
                        )
                      }
                    >
                      <subItem.icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors duration-150',
                          isSubActive ? 'text-accent' : 'text-text-secondary',
                        )}
                      />
                      <span className="ml-2.5 truncate">{t(subItem.labelKey)}</span>
                    </NavLink>
                  );
                })}
              </div>
            )}

            {/* Tooltip neo bên phải icon 8px khi collapsed (desktop) */}
            {isTooltipVisible && tooltipPos && (
              <div
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none fixed z-50 rounded-radius-sm bg-bg-inverse px-2.5 py-1.5 text-xs leading-4 font-normal text-text-inverse shadow-md animate-fade-in"
                style={{
                  top: tooltipPos.top,
                  left: tooltipPos.left,
                  transform: 'translateY(-50%)',
                }}
              >
                {label}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function SidebarHeader({ collapsed, onNavigate, onClose }: { collapsed: boolean; onNavigate?: () => void; onClose?: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'border-b border-border-subtle flex h-14 shrink-0 items-center justify-between overflow-hidden transition-all duration-200',
        collapsed ? 'justify-center px-2' : 'px-4',
      )}
    >
      <Link
        to="/"
        onClick={onNavigate}
        aria-label="EFS"
        title="EFS"
        className="flex items-center rounded-radius-sm p-1 transition-colors hover:bg-bg-subtle cursor-pointer overflow-hidden min-w-0"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-text-primary">
          <CascadeLogoIcon className="w-6 h-6 text-[#1C1B1A]" />
        </span>
        <div
          className={cn(
            'overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out',
            collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[140px] opacity-100 ml-2',
          )}
        >
          <span className="block truncate text-base font-semibold text-text-primary tracking-tight">EFS</span>
        </div>
      </Link>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common:nav.closeMenuAria')}
          className="flex h-8 w-8 items-center justify-center rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
        >
          <span className="text-lg leading-none font-medium">&times;</span>
        </button>
      )}
    </div>
  );
}

export function Sidebar() {
  const location = useLocation();

  // Kiem tra neu Secondary Sidebar dang mo o route phan cap (nhom Trang chu)
  const isSecondarySidebarOpen = HOME_ROUTE_PREFIXES.some(
    (prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
  );

  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  // Quy tac §4.1 & §4.3: Khi Secondary Sidebar mo -> Rail LUON Collapsed (w-16)
  const isRailCollapsed = isSecondarySidebarOpen ? true : sidebarCollapsed;

  return (
    <div className={cn('sticky top-0 hidden h-screen shrink-0 md:block transition-[width] duration-200', isRailCollapsed ? 'w-16' : 'w-60')}>
      <aside
        className={cn(
          'flex h-screen flex-col border-r border-border-subtle bg-bg-surface transition-[width] duration-200 ease-in-out',
          isRailCollapsed ? 'w-16' : 'w-60',
        )}
      >
        <SidebarHeader collapsed={isRailCollapsed} />
        <SidebarLinks collapsed={isRailCollapsed} />
      </aside>
    </div>
  );
}


/** 5. MobileSidebar: Drawer 288px (w-72), backdrop rgba(28,27,26,0.5), focus trap, close button, Esc, click-outside */
export function MobileSidebar() {
  const { t } = useTranslation();
  const open = useUIStore((s) => s.mobileSidebarOpen);
  const setOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    drawerRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }

      // Focus trap trong phạm vi drawer
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      {/* Backdrop rgba(28,27,26,0.5), khong blur theo spec §5.1 */}
      <div
        className="absolute inset-0 bg-[#1C1B1A]/50 animate-fade-in"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('common:nav.mobileDrawerAria')}
        tabIndex={-1}
        className="relative z-10 flex h-full w-72 max-w-[80vw] animate-slide-up flex-col rounded-r-radius-lg bg-bg-surface shadow-lg focus:outline-none"
      >
        <SidebarHeader collapsed={false} onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} />
        <div className="flex-1 overflow-y-auto">
          <SidebarLinks collapsed={false} onNavigate={() => setOpen(false)} isMobile={true} />
        </div>
      </div>
    </div>
  );
}
