import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS } from '@/constants/permissions';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/stores/auth.store';

// 17/09/2026: `requiredPermission` moi tren tung tab - truoc day CA 5 tab deu hien mac dinh mien
// nguoi dung da qua duoc lop bao ve ngoai /admin/* (requireAdmin, ProtectedRoute.tsx), gio lop
// bao ve ngoai do da doi sang canAccessAdminArea() (chi can 1 TRONG SO 6 quyen quan tri, xem
// lib/utils.ts) nen Manager (co USER_INVITE) cung vao duoc /admin/* - can loc rieng tung tab theo
// DUNG quyen ma tab do yeu cau, tranh Manager thay ca tab Vai tro & Quyen/Lich cong ty/Su kien loi
// he thong ma ho khong co quyen thao tac that su (BE se tra 403 neu co goi API). undefined = hien
// cho MOI nguoi da qua duoc lop bao ve ngoai (Thanh vien, Phong ban - khong yeu cau them quyen gi).
const TABS = [
  { to: '/admin/members', labelKey: 'admin:adminPage.tabs.members' },
  { to: '/admin/departments', labelKey: 'admin:adminPage.tabs.departments' },
  { to: '/admin/roles', labelKey: 'admin:adminPage.tabs.roles', requiredPermission: PERMISSIONS.ROLE_MANAGE },
  // 03/10/2026: bo tab "Lich cong ty" - lich dang duoc chuyen vao trang Nghi phep (xem
  // features/hrm/LeaveRequestsPage.tsx, task rieng ve i18n/migration lich).
  // 28/07/2026: tab moi cho man hinh chan doan Dead Letter Queue (GET /failed-events) - xem
  // FailedEventsPage.tsx.
  { to: '/admin/failed-events', labelKey: 'admin:adminPage.tabs.failedEvents', requiredPermission: PERMISSIONS.SYSTEM_MANAGE },
];

export function AdminPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const visibleTabs = TABS.filter((tab) => !tab.requiredPermission || permissions.includes(tab.requiredPermission));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] leading-[36px] font-semibold text-text-primary tracking-tight">{t('admin:adminPage.title')}</h1>
        <p className="mt-1 text-[14px] leading-[22px] text-text-secondary">{t('admin:adminPage.subtitle')}</p>
      </div>

      {/* Segmented Control phẳng: cuộn ngang 1 hàng trên mobile, không bị gãy 2 hàng */}
      <div className="w-full overflow-x-auto no-scrollbar pb-1">
        <div className="inline-flex items-center gap-1 rounded-radius-md bg-bg-subtle p-1 border border-border-subtle whitespace-nowrap">
          {visibleTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'px-3.5 py-1.5 text-[13px] leading-5 rounded-[4px] transition-all cursor-pointer font-medium shrink-0',
                  isActive
                    ? 'bg-white text-text-primary font-semibold border border-border-subtle'
                    : 'text-text-secondary hover:text-text-primary border border-transparent',
                )
              }
            >
              {t(tab.labelKey)}
            </NavLink>
          ))}
        </div>
      </div>

      <Outlet />
    </div>
  );
}
