import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { hasAdminRole } from '@/lib/utils';

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * Bat buoc vai tro quan tri (Sidebar chi AN link chu khong chan route thuc su - day la lop
   * bao ve that su o tang route cho /admin/* - bo sung 21/07/2026). Nguoi dung da xac thuc
   * nhung khong co vai tro quan tri se bi dieu huong ve /dashboard thay vi thay noi dung trang.
   */
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const accessToken = useAuthStore((s) => s.accessToken);
  const roles = useAuthStore((s) => s.user?.roles);
  const location = useLocation();

  if (isBootstrapping) {
    return <FullPageSpinner label="Đang khôi phục phiên đăng nhập…" />;
  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !hasAdminRole(roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
