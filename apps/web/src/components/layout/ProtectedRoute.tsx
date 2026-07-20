import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { FullPageSpinner } from '@/components/ui/Spinner';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();

  if (isBootstrapping) {
    return <FullPageSpinner label="Đang khôi phục phiên đăng nhập…" />;
  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
