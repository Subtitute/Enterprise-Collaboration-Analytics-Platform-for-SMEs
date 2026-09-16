import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/admin/members', labelKey: 'admin:adminPage.tabs.members' },
  { to: '/admin/departments', labelKey: 'admin:adminPage.tabs.departments' },
  { to: '/admin/roles', labelKey: 'admin:adminPage.tabs.roles' },
  // 15/09/2026: tab moi "Lich cong ty" (ngay le + su kien, theo yeu cau GVHD) - xem CalendarPage.tsx.
  { to: '/admin/calendar', labelKey: 'admin:adminPage.tabs.calendar' },
  // 28/07/2026: tab moi cho man hinh chan doan Dead Letter Queue (GET /failed-events) - xem
  // FailedEventsPage.tsx.
  { to: '/admin/failed-events', labelKey: 'admin:adminPage.tabs.failedEvents' },
];

export function AdminPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('admin:adminPage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('admin:adminPage.subtitle')}</p>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
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
