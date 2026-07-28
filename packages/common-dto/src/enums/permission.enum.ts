/**
 * Danh sach permission dang `resource:action` - Technical_Spec.md muc 6 (RBAC).
 * Duoc IAM Service dung de seed Role/Permission, va cac service khac dung de khai bao
 * @RequirePermissions(...) tren controller (qua packages/common-guard).
 */
export const PERMISSIONS = {
  // Organization / IAM
  ORG_MANAGE: 'organization:manage',
  USER_INVITE: 'user:invite',
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  DEPARTMENT_MANAGE: 'department:manage',

  // Project & Task
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_VIEW: 'project:view',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_VIEW: 'task:view',

  // Document
  DOCUMENT_UPLOAD: 'document:upload',
  DOCUMENT_DELETE: 'document:delete',
  DOCUMENT_SHARE: 'document:share',
  DOCUMENT_VIEW: 'document:view',

  // Analytics
  ANALYTICS_VIEW: 'analytics:view',

  // 28/07/2026: quyen van hanh/he thong (nang cap Dead Letter Queue) - xem chi tiet tai
  // notification-service/src/failed-events (danh sach event xu ly loi vinh vien). Chi Org Admin
  // duoc cap (qua DEFAULT_ROLE_PERMISSIONS.ORG_ADMIN = Object.values(PERMISSIONS) ben duoi, tu
  // dong bao gom quyen moi nay) - day la moi quan tam van hanh/ha tang, khong phai nghiep vu, nen
  // KHONG dua vao danh sach Manager/Employee.
  SYSTEM_MANAGE: 'system:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Vai tro mac dinh duoc seed khi 1 Organization dang ky moi - General_idea.md muc 4. */
export enum DefaultRoleName {
  ORG_ADMIN = 'Org Admin',
  MANAGER = 'Manager',
  EMPLOYEE = 'Employee',
}

export const DEFAULT_ROLE_PERMISSIONS: Record<DefaultRoleName, Permission[]> = {
  [DefaultRoleName.ORG_ADMIN]: Object.values(PERMISSIONS),
  [DefaultRoleName.MANAGER]: [
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_DELETE,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_DELETE,
    PERMISSIONS.DOCUMENT_SHARE,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.USER_INVITE,
  ],
  [DefaultRoleName.EMPLOYEE]: [
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.DOCUMENT_SHARE,
  ],
};
