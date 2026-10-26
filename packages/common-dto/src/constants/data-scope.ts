import { PERMISSIONS } from '../enums/permission.enum';

/**
 * 26/10/2026: Pham vi du lieu 3 cap dung chung cho moi service (Project/Task, CRM, HRM, IAM,
 * Analytics) - Manager phai CAO HON Employee va THAP HON Org Admin o moi module, khong con tinh
 * trang "Manager = Org Admin" (vd xem toan bo du an/khach hang/don nghi phep cua ca to chuc) nhu
 * truoc ngay nay:
 *  - 'organization': Org Admin (co PERMISSIONS.USER_MANAGE - dung LAI tin hieu "toan to chuc" da
 *    dung tu truoc o AnalyticsService.getRecentActivity()/ml-service/Notification Service, khong
 *    phat minh permission moi).
 *  - 'department': nguoi giu "quyen cap Manager" RIENG cua tung module (vd PROJECT_CREATE,
 *    CUSTOMER_CREATE, ATTENDANCE_VIEW - chinh ranh gioi Employee/Manager da co san trong
 *    DEFAULT_ROLE_PERMISSIONS) VA da duoc gan phong ban (departmentId trong JWT/AuthContext).
 *  - 'self': con lai - Employee, hoac Manager chua duoc gan phong ban nao (khong co "phong ban cua
 *    minh" de mo rong pham vi, nen chi con du lieu cua chinh minh).
 * Ham thuan (khong phu thuoc DB) de moi service goi giong nhau va unit test doc lap.
 */
export type DataScope = 'organization' | 'department' | 'self';

export function resolveDataScope(
  permissions: readonly string[] | null | undefined,
  departmentScopePermission: string,
  departmentId: string | null | undefined,
): DataScope {
  const granted = permissions ?? [];
  if (granted.includes(PERMISSIONS.USER_MANAGE)) return 'organization';
  if (granted.includes(departmentScopePermission) && departmentId) return 'department';
  return 'self';
}
