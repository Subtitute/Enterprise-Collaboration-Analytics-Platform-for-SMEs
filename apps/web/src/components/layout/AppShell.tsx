import { Outlet } from 'react-router-dom';
import { Sidebar, MobileSidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useNotificationSocket } from '@/features/notifications/hooks';

export function AppShell() {
  // Thong bao can ket noi xuyen suot (badge o Topbar hien dien tren moi trang).
  // Socket /ws/analytics chi can thiet o Dashboard nen duoc quan ly rieng trong
  // features/dashboard/hooks.ts (useRecentActivityFeed) de tranh ket noi thua khi khong dung toi.
  useNotificationSocket();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <MobileSidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
