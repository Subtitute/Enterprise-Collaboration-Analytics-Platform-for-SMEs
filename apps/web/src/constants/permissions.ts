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
  // 24/09/2026: Layer 3 Anomaly Detection (apps/ml-service) - mirror packages/common-dto/src/enums/permission.enum.ts.
  ML_VIEW: 'ml:view',

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
  ATTENDANCE_ADJUSTMENT_CREATE: 'attendance_adjustment:create',
  ATTENDANCE_ADJUSTMENT_VIEW: 'attendance_adjustment:view',
  ATTENDANCE_ADJUSTMENT_APPROVE: 'attendance_adjustment:approve',
  OVERTIME_REQUEST_CREATE: 'overtime_request:create',
  OVERTIME_REQUEST_VIEW: 'overtime_request:view',
  OVERTIME_REQUEST_APPROVE: 'overtime_request:approve',

  // Hệ thống & Quản trị
  SYSTEM_MANAGE: 'system:manage',
  CALENDAR_MANAGE: 'calendar:manage',

  // 28/09/2026: Messaging Service (nhắn tin nội bộ 1:1 và nhóm/kênh) - mirror
  // packages/common-dto/src/enums/permission.enum.ts. MESSAGE_MANAGE_GROUP tách riêng khỏi
  // MESSAGE_SEND vì "thêm/bớt thành viên nhóm" là hành động quản trị nhóm khác với "gửi tin nhắn"
  // (người tạo nhóm vẫn thao tác được nhóm của chính mình dù không giữ quyền này - xem
  // ConversationsService.updateParticipants() trong apps/messaging-service).
  MESSAGE_VIEW: 'message:view',
  MESSAGE_SEND: 'message:send',
  MESSAGE_MANAGE_GROUP: 'message:manage_group',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

