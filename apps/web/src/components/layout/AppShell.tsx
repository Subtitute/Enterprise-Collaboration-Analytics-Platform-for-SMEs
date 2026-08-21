import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sidebar, MobileSidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useNotificationSocket } from '@/features/notifications/hooks';
// 25/07/2026: them useSidebarAutoCollapse - xem hooks/useSidebarAutoCollapse.ts. Goi o day (goc
// layout, mount dung 1 lan cho toan bo cac trang da dang nhap) de Sidebar tu thu gon o do rong
// tablet theo Wireframe.md muc 10, thay vi giu nguyen trang thai cu bat ke kich thuoc man hinh.
import { useSidebarAutoCollapse } from '@/hooks/useSidebarAutoCollapse';

export function AppShell() {
  const { t } = useTranslation();
  // Thong bao can ket noi xuyen suot (badge o Topbar hien dien tren moi trang).
  // Socket /ws/analytics chi can thiet o Dashboard nen duoc quan ly rieng trong
  // features/dashboard/hooks.ts (useRecentActivityFeed) de tranh ket noi thua khi khong dung toi.
  useNotificationSocket();
  useSidebarAutoCollapse(); // 25/07/2026: xem ghi chu import o tren.

  // 28/07/2026: bo sung "skip to content" + chuyen focus khi doi trang (phat hien qua ra soat kha
  // nang tiep can) - SPA dieu huong phia client KHONG reload trang nhu web truyen thong, nen focus
  // ban phim tu nhien VAN nam o lien ket vua bam (thuong o Sidebar/Topbar); nguoi dung dung ban
  // phim phai Tab lai TU DAU qua toan bo Sidebar + Topbar (tim kiem, thong bao, menu tai khoan) o
  // MOI lan chuyen trang moi toi duoc noi dung. Focus vao <main> ngay sau khi doi route vua dua
  // nguoi dung ban phim toi dung noi dung moi, vua la tin hieu (du gian tiep) de trinh doc man hinh
  // biet trang da doi. Lien ket "bo qua" (an, chi hien khi nhan Tab toi) phuc vu truong hop nguoi
  // dung ban phim bat dau tu Topbar/URL bar, chua tung dieu huong qua route nao trong phien nay.
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-700 focus:shadow-lg focus:ring-2 focus:ring-primary-400"
      >
        {t('common:skipToContent')}
      </a>
      <Sidebar />
      <MobileSidebar />
      {/* 20/08/2026: them min-w-0 - phat hien qua bao loi thuc te: div nay la flex item trong hang
          flex ben ngoai (chung voi Sidebar) nhung khong co min-w-0 nen mac dinh min-width: auto,
          tu choi thu nho hon do rong noi dung ben trong (bang co md:min-w-[560px], luoi KPI
          grid-cols-4, cot Kanban co do rong co dinh...). Ket qua: khi thu hep vien trinh duyet
          (vd mo DevTools/F12), CA COT NOI DUNG tran ra ngoai vien man hinh thay vi noi dung ben
          trong tu cuon ngang trong bien cua no. */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main-content" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 p-4 sm:p-6 focus:outline-none">
          {/* 28/07/2026: Suspense rieng cho Outlet (khac voi Suspense goc o App.tsx) - de Sidebar/
              Topbar (component o TREN, ngoai boundary nay) khong bi thay bang fallback moi lan
              chuyen trang, chi vung noi dung chinh hien spinner trong luc tai chunk cua trang moi. */}
          <Suspense fallback={<FullPageSpinner label={t('common:loadingPage')} />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
