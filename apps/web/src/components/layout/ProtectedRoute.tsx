import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { canAccessAdminArea } from '@/lib/utils';

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * Bat buoc vai tro quan tri (Sidebar chi AN link chu khong chan route thuc su - day la lop
   * bao ve that su o tang route cho /admin/* - bo sung 21/07/2026). Nguoi dung da xac thuc
   * nhung khong co vai tro quan tri se bi dieu huong ve /dashboard thay vi thay noi dung trang.
   */
  requireAdmin?: boolean;
  /**
   * 16/09/2026: "Super Admin" (tinh nang moi) - bat buoc danh cho route /platform-admin DUY NHAT.
   * Nguoi dung da xac thuc nhung KHONG phai Super Admin se bi dieu huong ve /dashboard.
   */
  requireSuperAdmin?: boolean;
  /**
   * 17/09/2026: bao ve tang ROUTE (khac requireAdmin - kiem tra 1 permission cu the thay vi ca
   * nhom quyen quan tri) - dung cho /analytics (yeu cau ANALYTICS_VIEW, xem nav-items.ts). Sidebar
   * chi AN link chu khong chan dieu huong truc tiep bang URL, giong ly do requireAdmin da co san.
   */
  requiredPermission?: string;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  requireSuperAdmin = false,
  requiredPermission,
}: ProtectedRouteProps) {
  const { t } = useTranslation();
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const accessToken = useAuthStore((s) => s.accessToken);
  const permissions = usePermissions();
  const isSuperAdmin = useAuthStore((s) => s.user?.isSuperAdmin ?? false);
  const location = useLocation();

  if (isBootstrapping) {
    return <FullPageSpinner label={t('common:session.restoring')} />;
  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 16/09/2026: "Super Admin" khong thuoc to chuc nghiep vu nao ca - moi trang theo to chuc
  // (dashboard/du an/CRM/HRM...) deu vo nghia/trong rong doi voi ho. Dieu huong het ve khu vuc
  // dung cua ho (/platform-admin) thay vi hien 1 dashboard trong khong co du lieu that.
  if (isSuperAdmin && !requireSuperAdmin) {
    return <Navigate to="/platform-admin" replace />;
  }
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdmin && !canAccessAdminArea(permissions)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredPermission && !permissions.includes(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
