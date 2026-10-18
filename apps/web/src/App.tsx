import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { silentRefresh } from '@/lib/api-client';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { NotFoundPage } from '@/components/layout/NotFoundPage';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { PERMISSIONS } from '@/constants/permissions';

// 28/07/2026: chuyen toan bo trang cap route sang React.lazy() - phat hien qua de xuat nang cap
// (khong phai loi) rang bundle production truoc day gom TOAN BO 13 trang vao 1 chunk duy nhat
// (~954KB, vuot canh bao 500KB cua Vite) du nguoi dung chi can tai vi du trang Dang nhap luc dau.
// Voi dong bo dung dynamic import(), Vite tu tach moi trang thanh 1 chunk rieng - trinh duyet chi
// tai code cua trang dang xem, cac trang con lai tai ngam khi dieu huong toi. AppShell/
// ProtectedRoute/NotFoundPage giu nguyen import tinh (nho, dung ngay tu dau, khong dang tach).
const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
// 15/09/2026: "Quen mat khau" (phan hoi GVHD, muc 4) - cung khuon mau lazy() voi Login/Register.
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProjectsListPage = lazy(() => import('@/features/projects/ProjectsListPage').then((m) => ({ default: m.ProjectsListPage })));
const ProjectDetailPage = lazy(() => import('@/features/projects/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })));
const DocumentsPage = lazy(() => import('@/features/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })));
// 04/08/2026: CRM-lite (Technical_Spec.md muc 16) - khach hang + pipeline ban hang.
const CustomersListPage = lazy(() => import('@/features/crm/CustomersListPage').then((m) => ({ default: m.CustomersListPage })));
const CustomerDetailPage = lazy(() => import('@/features/crm/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })));
// 15/10/2026: Inventory Service (Danh muc san pham + Kho, Technical_Spec.md muc 22).
const ProductsPage = lazy(() => import('@/features/inventory/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const WarehousePage = lazy(() => import('@/features/inventory/WarehousePage').then((m) => ({ default: m.WarehousePage })));
// 05/08/2026: HRM-lite (Technical_Spec.md muc 17) - cham cong (photo-proof) + nghi phep.
const AttendancePage = lazy(() => import('@/features/hrm/AttendancePage').then((m) => ({ default: m.AttendancePage })));
// 03/10/2026: trang chi tiet cham cong/nghi phep theo tung nhan vien (component mac dinh, khong
// phai named export nhu phan lon cac trang con lai o day - xem features/hrm/AttendanceDetailPage.tsx
// va LeaveRequestDetailPage.tsx).
const AttendanceDetailPage = lazy(() => import('@/features/hrm/AttendanceDetailPage'));
const LeaveRequestsPage = lazy(() => import('@/features/hrm/LeaveRequestsPage').then((m) => ({ default: m.LeaveRequestsPage })));
const LeaveRequestDetailPage = lazy(() => import('@/features/hrm/LeaveRequestDetailPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
// 28/09/2026: Messaging Service (nhan tin noi bo 1:1 va nhom/kenh) - cung khuon mau lazy() voi cac
// trang con lai, khong permission gate rieng tren route (xem ghi chu tai nav-items.ts).
const ConversationsPage = lazy(() => import('@/features/messaging/ConversationsPage').then((m) => ({ default: m.ConversationsPage })));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const AdminPage = lazy(() => import('@/features/admin/AdminPage').then((m) => ({ default: m.AdminPage })));
const MembersPage = lazy(() => import('@/features/admin/MembersPage').then((m) => ({ default: m.MembersPage })));
const DepartmentsPage = lazy(() => import('@/features/admin/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage })));
const RolesPermissionsPage = lazy(() => import('@/features/admin/RolesPermissionsPage').then((m) => ({ default: m.RolesPermissionsPage })));
// 28/07/2026: trang moi "Sự kiện lỗi hệ thống" (Dead Letter Queue, GET /failed-events) - theo
// dung khuon mau lazy() cua cac trang /admin/* con lai o tren.
const FailedEventsPage = lazy(() => import('@/features/admin/FailedEventsPage').then((m) => ({ default: m.FailedEventsPage })));
// 16/09/2026: "Super Admin" (tinh nang moi) - trang rieng, KHONG long trong AppShell (xem
// ProtectedRoute.tsx/PlatformAdminPage.tsx).
const PlatformAdminPage = lazy(() => import('@/features/platform-admin/PlatformAdminPage').then((m) => ({ default: m.PlatformAdminPage })));

export default function App() {
  const { t } = useTranslation();
  const hasPersistedUser = useAuthStore((s) => Boolean(s.user));
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);

  // Boot cua ung dung: refresh token khong con doc duoc tu JS (httpOnly cookie - xem
  // stores/auth.store.ts, lib/api-client.ts). Neu truoc do da co user duoc persist (tung dang
  // nhap), thu silent-refresh 1 lan (goi /auth/refresh KHONG kem body, cookie tu dong gui kem
  // nho withCredentials: true) de lay accessToken moi ma khong bat dang nhap lai sau khi F5.
  // That bai (thieu/het han cookie) -> silentRefresh tu clearSession(), ProtectedRoute se
  // dieu huong ve /login vi accessToken con null (giu nguyen fallback cu).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (hasPersistedUser) {
        await silentRefresh();
      }
      if (!cancelled) setBootstrapped();
    })();
    return () => {
      cancelled = true;
    };
    // Chi chay 1 lan luc mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // 28/07/2026: Suspense bao ngoai cung - can thiet cho lan chuyen route DAU TIEN (vd tai thang
    // /login truoc khi AppShell/ProtectedRoute duoc mount) khi chunk cua trang do chua tai xong.
    // Suspense rieng, gan hon, cho phan Outlet ben trong AppShell (xem AppShell.tsx) moi la noi xu
    // ly da so truong hop dieu huong giua cac trang da dang nhap - de Sidebar/Topbar khong bi go
    // mount/tai lai moi lan chuyen trang.
    <Suspense fallback={<FullPageSpinner label={t('common:loading')} />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* 16/09/2026: "Super Admin" - route rieng, KHONG long trong AppShell (ProtectedRoute tu
            dieu huong het Super Admin ve day, xem ProtectedRoute.tsx). */}
        <Route
          path="/platform-admin"
          element={
            <ProtectedRoute requireSuperAdmin>
              <PlatformAdminPage />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsListPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/customers" element={<CustomersListPage />} />
          <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
          {/* 15/10/2026: Inventory Service - khong ProtectedRoute requiredPermission (PRODUCT_VIEW/
              WAREHOUSE_VIEW cap cho ca 3 vai tro, mirror /customers ngay tren). */}
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/warehouse" element={<WarehousePage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          {/* 03/10/2026: trang chi tiet cham cong 1 nhan vien (xem AttendanceDetailPage.tsx). */}
          <Route path="/attendance/:userId" element={<AttendanceDetailPage />} />
          <Route path="/leave-requests" element={<LeaveRequestsPage />} />
          {/* 03/10/2026: trang chi tiet nghi phep 1 nhan vien (xem LeaveRequestDetailPage.tsx). */}
          <Route path="/leave-requests/:userId" element={<LeaveRequestDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/messages" element={<ConversationsPage />} />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute requiredPermission={PERMISSIONS.ANALYTICS_VIEW}>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminPage />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="members" replace />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
            <Route path="roles" element={<RolesPermissionsPage />} />
            {/* 28/07/2026: route cho tab moi "Sự kiện lỗi hệ thống" (xem TABS trong AdminPage.tsx). */}
            <Route path="failed-events" element={<FailedEventsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
