import { Outlet } from 'react-router-dom';
import { Sidebar, MobileSidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useNotificationSocket } from '@/features/notifications/hooks';
// 25/07/2026: them useSidebarAutoCollapse - xem hooks/useSidebarAutoCollapse.ts. Goi o day (goc
// layout, mount dung 1 lan cho toan bo cac trang da dang nhap) de Sidebar tu thu gon o do rong
// tablet theo Wireframe.md muc 10, thay vi giu nguyen trang thai cu bat ke kich thuoc man hinh.
import { useSidebarAutoCollapse } from '@/hooks/useSidebarAutoCollapse';

export function AppShell() {
  // Thong bao can ket noi xuyen suot (badge o Topbar hien dien tren moi trang).
  // Socket /ws/analytics chi can thiet o Dashboard nen duoc quan ly rieng trong
  // features/dashboard/hooks.ts (useRecentActivityFeed) de tranh ket noi thua khi khong dung toi.
  useNotificationSocket();
  useSidebarAutoCollapse(); // 25/07/2026: xem ghi chu import o tren.

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
