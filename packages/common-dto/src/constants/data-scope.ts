import { DefaultRoleName, PERMISSIONS } from '../enums/permission.enum';

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

/**
 * 26/10/2026: muc vai tro cua 1 user (Technical_Spec.md muc 27.4/27.7) - suy tu TEN vai tro vi he
 * thong chi co dung 3 vai tro mac dinh va khong co endpoint tao vai tro (muc 19.5). Dung de xac dinh
 * "muc tieu hop le cua Manager" (chi Employee) o iam-service va trong payload su kien cho ml-service.
 * Nhieu vai tro -> lay muc cao nhat; khong co vai tro nao -> EMPLOYEE (muc thap nhat).
 */
export type RoleLevel = 'ORG_ADMIN' | 'MANAGER' | 'EMPLOYEE';

export function resolveRoleLevel(roleNames: readonly string[] | null | undefined): RoleLevel {
  const names = (roleNames ?? []).map((n) => n.trim().toLowerCase());
  if (names.includes(DefaultRoleName.ORG_ADMIN.toLowerCase())) return 'ORG_ADMIN';
  if (names.includes(DefaultRoleName.MANAGER.toLowerCase())) return 'MANAGER';
  return 'EMPLOYEE';
}

/**
 * 26/10/2026: chuan hoa so dien thoai Viet Nam (muc 27.10) - bo khoang trang/dau cham/gach/ngoac,
 * "+84"/"84" dau -> "0". Hop le: di dong ^0[35789]\d{8}$ hoac co dinh ^02\d{9}$. Tra ve null neu
 * khong hop le (chuoi rong do noi goi xu ly rieng = xoa so).
 */
export function normalizeVietnamesePhone(raw: string): string | null {
  let digits = raw.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`;
  else if (/^84\d{9,10}$/.test(digits)) digits = `0${digits.slice(2)}`;
  return /^0[35789]\d{8}$/.test(digits) || /^02\d{9}$/.test(digits) ? digits : null;
}

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
