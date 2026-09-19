/**
 * Danh sách permissions của hệ thống (đồng bộ với packages/common-dto/src/enums/permission.enum.ts).
 * Khai báo trực tiếp dạng TypeScript ESM thuần túy cho Frontend để tránh hoàn toàn lỗi
 * "Uncaught ReferenceError: exports is not defined" khi Vite dev server nạp tệp CommonJS biên dịch sâu.
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

  // CRM-lite
  CUSTOMER_VIEW: 'customer:view',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_DELETE: 'customer:delete',
  DEAL_VIEW: 'deal:view',
  DEAL_CREATE: 'deal:create',
  DEAL_UPDATE: 'deal:update',
  DEAL_DELETE: 'deal:delete',

  // HRM-lite
  ATTENDANCE_CHECKIN: 'attendance:checkin',
  ATTENDANCE_VIEW: 'attendance:view',
  LEAVE_REQUEST_CREATE: 'leave_request:create',
  LEAVE_REQUEST_VIEW: 'leave_request:view',
  LEAVE_REQUEST_APPROVE: 'leave_request:approve',

  // Hệ thống & Quản trị
  SYSTEM_MANAGE: 'system:manage',
  CALENDAR_MANAGE: 'calendar:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

