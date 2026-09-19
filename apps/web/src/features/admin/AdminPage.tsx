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
  // 15/09/2026: tab moi "Lich cong ty" (ngay le + su kien, theo yeu cau GVHD) - xem CalendarPage.tsx.
  { to: '/admin/calendar', labelKey: 'admin:adminPage.tabs.calendar', requiredPermission: PERMISSIONS.CALENDAR_MANAGE },
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('admin:adminPage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('admin:adminPage.subtitle')}</p>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700',
              )
            }
          >
            {t(tab.labelKey)}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
