import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { silentRefresh } from '@/lib/api-client';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { NotFoundPage } from '@/components/layout/NotFoundPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ProjectsListPage } from '@/features/projects/ProjectsListPage';
import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage';
import { DocumentsPage } from '@/features/documents/DocumentsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { AdminPage } from '@/features/admin/AdminPage';
import { MembersPage } from '@/features/admin/MembersPage';
import { DepartmentsPage } from '@/features/admin/DepartmentsPage';
import { RolesPermissionsPage } from '@/features/admin/RolesPermissionsPage';

export default function App() {
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
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

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
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />

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
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
