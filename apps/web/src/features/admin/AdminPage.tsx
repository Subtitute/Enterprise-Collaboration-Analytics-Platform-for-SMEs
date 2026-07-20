import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/admin/members', label: 'Thành viên' },
  { to: '/admin/departments', label: 'Phòng ban' },
  { to: '/admin/roles', label: 'Vai trò & Quyền' },
];

export function AdminPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Quản trị</h1>
        <p className="text-sm text-slate-500">Quản lý thành viên, phòng ban và phân quyền truy cập hệ thống.</p>
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
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
