import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { refreshSession } from '@/features/auth/api';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { NotFoundPage } from '@/components/layout/NotFoundPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ProjectsListPage } from '@/features/projects/ProjectsListPage';
import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage';
import { DocumentsPage } from '@/features/documents/DocumentsPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { AdminPage } from '@/features/admin/AdminPage';
import { MembersPage } from '@/features/admin/MembersPage';
import { DepartmentsPage } from '@/features/admin/DepartmentsPage';
import { RolesPermissionsPage } from '@/features/admin/RolesPermissionsPage';

export default function App() {
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);

  // Boot cua ung dung: neu co refreshToken da luu (localStorage), thu silent-refresh 1 lan de
  // lay accessToken moi ma khong bat nguoi dung dang nhap lai sau khi F5. Xem stores/auth.store.ts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (refreshToken) {
        try {
          const session = await refreshSession(refreshToken);
          if (!cancelled) setSession(session);
        } catch {
          if (!cancelled) clearSession();
        }
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
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />

        <Route path="/admin" element={<AdminPage />}>
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
