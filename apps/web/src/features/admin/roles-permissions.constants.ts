// 16/09/2026: PERMISSION_META la hang so o module-level (ngoai component) nen khong the goi
// useTranslation() o day (vi pham Rules of Hooks) - dung tham chieu `t` khong-qua-hook tu
// i18n/index.ts, theo dung tien le da ap dung o TaskStatusDonut.tsx.
import { t } from '@/i18n';

/**
 * Bản đồ dịch tên quyền kỹ thuật sang tiếng Việt tường minh và chỉ định phân hệ module.
 */
// 24/10/2026: bo sung nhom 'inventory' (8 quyen San pham & Kho) va quyen chatbot:use (nhom
// 'message', nhan nhom doi thanh "Nhan tin & Tro ly AI") - truoc day cac quyen nay roi vao nhom
// 'Khac' voi nhan la key ky thuat tho. RolesPermissionsPage.test.ts doi chieu PERMISSION_META voi
// PERMISSIONS (common-dto): quyen moi nao quen khai bao o day se lam test that bai.
export type ModuleKey = 'hrm' | 'crm' | 'inventory' | 'project' | 'document' | 'message' | 'analytics' | 'iam' | 'system';

export interface PermissionMeta {
  label: string;
  moduleKey: ModuleKey;
  order: number;
}

// 16/09/2026: cac `label` duoi day tung la chuoi tieng Viet hardcode truc tiep (vi pham
// scripts/check-hardcoded-vietnamese.js) - chuyen sang goi t() voi key
// admin:rolesPermissionsPage.permissions.<key voi ':' -> '_'>, dung key da co san (va dung khop
// tung ky tu) trong locales/{vi,en,ja}/admin.json, giong cach translationKey duoc dung khi render
// ben duoi nen khong tao trung lap noi dung dich.
export const PERMISSION_META: Record<string, PermissionMeta> = {
  // HRM-lite: Chấm công & Nghỉ phép
  'attendance:checkin': { label: t('admin:rolesPermissionsPage.permissions.attendance_checkin'), moduleKey: 'hrm', order: 1 },
  'attendance:view': { label: t('admin:rolesPermissionsPage.permissions.attendance_view'), moduleKey: 'hrm', order: 2 },
  'attendance_adjustment:create': { label: t('admin:rolesPermissionsPage.permissions.attendance_adjustment_create'), moduleKey: 'hrm', order: 3 },
  'attendance_adjustment:view': { label: t('admin:rolesPermissionsPage.permissions.attendance_adjustment_view'), moduleKey: 'hrm', order: 4 },
  'attendance_adjustment:approve': { label: t('admin:rolesPermissionsPage.permissions.attendance_adjustment_approve'), moduleKey: 'hrm', order: 5 },
  'leave_request:create': { label: t('admin:rolesPermissionsPage.permissions.leave_request_create'), moduleKey: 'hrm', order: 6 },
  'leave_request:view': { label: t('admin:rolesPermissionsPage.permissions.leave_request_view'), moduleKey: 'hrm', order: 7 },
  'leave_request:approve': { label: t('admin:rolesPermissionsPage.permissions.leave_request_approve'), moduleKey: 'hrm', order: 8 },
  'overtime_request:create': { label: t('admin:rolesPermissionsPage.permissions.overtime_request_create'), moduleKey: 'hrm', order: 9 },
  'overtime_request:view': { label: t('admin:rolesPermissionsPage.permissions.overtime_request_view'), moduleKey: 'hrm', order: 10 },
  'overtime_request:approve': { label: t('admin:rolesPermissionsPage.permissions.overtime_request_approve'), moduleKey: 'hrm', order: 11 },
  'calendar:manage': { label: t('admin:rolesPermissionsPage.permissions.calendar_manage'), moduleKey: 'hrm', order: 12 },

  // CRM-lite: Khách hàng & Bán hàng
  'customer:view': { label: t('admin:rolesPermissionsPage.permissions.customer_view'), moduleKey: 'crm', order: 20 },
  'customer:create': { label: t('admin:rolesPermissionsPage.permissions.customer_create'), moduleKey: 'crm', order: 21 },
  'customer:update': { label: t('admin:rolesPermissionsPage.permissions.customer_update'), moduleKey: 'crm', order: 22 },
  'customer:delete': { label: t('admin:rolesPermissionsPage.permissions.customer_delete'), moduleKey: 'crm', order: 23 },
  'deal:view': { label: t('admin:rolesPermissionsPage.permissions.deal_view'), moduleKey: 'crm', order: 24 },
  'deal:create': { label: t('admin:rolesPermissionsPage.permissions.deal_create'), moduleKey: 'crm', order: 25 },
  'deal:update': { label: t('admin:rolesPermissionsPage.permissions.deal_update'), moduleKey: 'crm', order: 26 },
  'deal:delete': { label: t('admin:rolesPermissionsPage.permissions.deal_delete'), moduleKey: 'crm', order: 27 },

  // 24/10/2026: Inventory: Sản phẩm & Kho (gồm giao dịch mua hàng của khách)
  'product:view': { label: t('admin:rolesPermissionsPage.permissions.product_view'), moduleKey: 'inventory', order: 90 },
  'product:manage': { label: t('admin:rolesPermissionsPage.permissions.product_manage'), moduleKey: 'inventory', order: 91 },
  'warehouse:view': { label: t('admin:rolesPermissionsPage.permissions.warehouse_view'), moduleKey: 'inventory', order: 92 },
  'warehouse:manage': { label: t('admin:rolesPermissionsPage.permissions.warehouse_manage'), moduleKey: 'inventory', order: 93 },
  'customer_purchase:view': { label: t('admin:rolesPermissionsPage.permissions.customer_purchase_view'), moduleKey: 'inventory', order: 94 },
  'customer_purchase:create': { label: t('admin:rolesPermissionsPage.permissions.customer_purchase_create'), moduleKey: 'inventory', order: 95 },
  'customer_purchase:update': { label: t('admin:rolesPermissionsPage.permissions.customer_purchase_update'), moduleKey: 'inventory', order: 96 },
  'customer_purchase:delete': { label: t('admin:rolesPermissionsPage.permissions.customer_purchase_delete'), moduleKey: 'inventory', order: 97 },

  // Project & Task: Dự án & Công việc
  'project:view': { label: t('admin:rolesPermissionsPage.permissions.project_view'), moduleKey: 'project', order: 30 },
  'project:create': { label: t('admin:rolesPermissionsPage.permissions.project_create'), moduleKey: 'project', order: 31 },
  'project:update': { label: t('admin:rolesPermissionsPage.permissions.project_update'), moduleKey: 'project', order: 32 },
  'project:delete': { label: t('admin:rolesPermissionsPage.permissions.project_delete'), moduleKey: 'project', order: 33 },
  'task:view': { label: t('admin:rolesPermissionsPage.permissions.task_view'), moduleKey: 'project', order: 34 },
  'task:create': { label: t('admin:rolesPermissionsPage.permissions.task_create'), moduleKey: 'project', order: 35 },
  'task:update': { label: t('admin:rolesPermissionsPage.permissions.task_update'), moduleKey: 'project', order: 36 },
  'task:delete': { label: t('admin:rolesPermissionsPage.permissions.task_delete'), moduleKey: 'project', order: 37 },

  // Document: Tài liệu & Lưu trữ
  'document:view': { label: t('admin:rolesPermissionsPage.permissions.document_view'), moduleKey: 'document', order: 40 },
  'document:upload': { label: t('admin:rolesPermissionsPage.permissions.document_upload'), moduleKey: 'document', order: 41 },
  'document:share': { label: t('admin:rolesPermissionsPage.permissions.document_share'), moduleKey: 'document', order: 42 },
  'document:delete': { label: t('admin:rolesPermissionsPage.permissions.document_delete'), moduleKey: 'document', order: 43 },

  // Messaging: Tin nhắn nội bộ + Trợ lý AI (chatbot, 24/10/2026)
  'message:view': { label: t('admin:rolesPermissionsPage.permissions.message_view'), moduleKey: 'message', order: 50 },
  'message:send': { label: t('admin:rolesPermissionsPage.permissions.message_send'), moduleKey: 'message', order: 51 },
  'message:manage_group': { label: t('admin:rolesPermissionsPage.permissions.message_manage_group'), moduleKey: 'message', order: 52 },
  'chatbot:use': { label: t('admin:rolesPermissionsPage.permissions.chatbot_use'), moduleKey: 'message', order: 53 },

  // Analytics & ML: Báo cáo & Phân tích
  'analytics:view': { label: t('admin:rolesPermissionsPage.permissions.analytics_view'), moduleKey: 'analytics', order: 60 },
  'ml:view': { label: t('admin:rolesPermissionsPage.permissions.ml_view'), moduleKey: 'analytics', order: 61 },

  // Organization & IAM: Tổ chức & Phân quyền
  'user:invite': { label: t('admin:rolesPermissionsPage.permissions.user_invite'), moduleKey: 'iam', order: 70 },
  'user:manage': { label: t('admin:rolesPermissionsPage.permissions.user_manage'), moduleKey: 'iam', order: 71 },
  'department:manage': { label: t('admin:rolesPermissionsPage.permissions.department_manage'), moduleKey: 'iam', order: 72 },
  'role:manage': { label: t('admin:rolesPermissionsPage.permissions.role_manage'), moduleKey: 'iam', order: 73 },
  'organization:manage': { label: t('admin:rolesPermissionsPage.permissions.organization_manage'), moduleKey: 'iam', order: 74 },

  // System & Diagnostics: Hạ tầng & Hệ thống
  'system:manage': { label: t('admin:rolesPermissionsPage.permissions.system_manage'), moduleKey: 'system', order: 80 },
};

/** Danh sách thứ tự hiển thị của các module nghiệp vụ */
// 26/10/2026 - Rà soát phân quyền: gom đủ nhóm 'inventory' (Sản phẩm & Kho) và 'message' (Nhắn tin & Trợ lý AI), loại bỏ hoàn toàn nhóm 'Khác'
export const MODULE_ORDER: Array<{ key: ModuleKey }> = [
  { key: 'hrm' },
  { key: 'crm' },
  { key: 'inventory' },
  { key: 'project' },
  { key: 'document' },
  { key: 'message' },
  { key: 'analytics' },
  { key: 'iam' },
  { key: 'system' },
];

/**
 * Kiểm tra xem vai trò có phải là Org Admin (Quản trị viên tối cao) hay không để áp dụng cơ chế khóa an toàn (Safety Lock)
 */
export function isOrgAdminRole(roleName: string): boolean {
  const lower = roleName.trim().toLowerCase();
  // 16/09/2026: chuoi tieng Viet ben duoi la gia tri SO KHOP ten vai tro (phong truong hop 1 to
  // chuc da tu doi ten vai tro sang tieng Viet), khong phai text hien thi cho nguoi dung - text
  // hien thi luon di qua t() o formatRoleName ben duoi. (i18n-lint-ignore)
  return lower.includes('org admin') || lower === 'admin' || lower.includes('quản trị viên tối cao') || lower.includes('organization admin');
}

/**
 * Định dạng tên vai trò theo ngôn ngữ hiện hành
 */
export function formatRoleName(roleName: string, tFunc: (key: string) => string): string {
  const lower = roleName.trim().toLowerCase();
  // 16/09/2026: cac chuoi tieng Viet trong 3 dieu kien duoi day la gia tri SO KHOP ten vai tro cu/
  // da tuy chinh, khong phai text hien thi cho nguoi dung - text hien thi luon di qua t() ngay ben duoi.
  if (lower.includes('admin') || lower.includes('quản trị')) { // i18n-lint-ignore
    return tFunc('admin:roles.orgAdmin');
  }
  if (lower.includes('manager') || lower.includes('quản lý')) { // i18n-lint-ignore
    return tFunc('admin:roles.manager');
  }
  if (lower.includes('employee') || lower.includes('nhân viên')) { // i18n-lint-ignore
    return tFunc('admin:roles.employee');
  }
  return roleName;
}

