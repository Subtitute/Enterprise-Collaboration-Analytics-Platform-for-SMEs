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
  // 24/09/2026: Layer 3 Anomaly Detection (apps/ml-service, IsolationForest theo yeu cau bam nut)
  // - quyen RIENG (khong dung chung ANALYTICS_VIEW) vi day la du lieu nhay cam hon (danh gia bat
  // thuong ve TUNG nhan vien cu the, khong chi so tong hop) - cho phep cap rieng biet neu can sau
  // nay, mirror dung cach tach ATTENDANCE_VIEW rieng khoi cac quyen HRM khac.
  ML_VIEW: 'ml:view',

  // CRM-lite (bo sung 04/08/2026) - khach hang va co hoi ban hang (deal pipeline)
  CUSTOMER_VIEW: 'customer:view',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_DELETE: 'customer:delete',
  DEAL_VIEW: 'deal:view',
  DEAL_CREATE: 'deal:create',
  DEAL_UPDATE: 'deal:update',
  DEAL_DELETE: 'deal:delete',

  // HRM-lite (bo sung 05/08/2026) - cham cong (check-in/out kem anh) va nghi phep
  ATTENDANCE_CHECKIN: 'attendance:checkin',
  ATTENDANCE_VIEW: 'attendance:view',
  LEAVE_REQUEST_CREATE: 'leave_request:create',
  LEAVE_REQUEST_VIEW: 'leave_request:view',
  LEAVE_REQUEST_APPROVE: 'leave_request:approve',

  // 28/07/2026: quyen van hanh/he thong (nang cap Dead Letter Queue) - xem chi tiet tai
  // notification-service/src/failed-events (danh sach event xu ly loi vinh vien). Chi Org Admin
  // duoc cap (qua DEFAULT_ROLE_PERMISSIONS.ORG_ADMIN = Object.values(PERMISSIONS) ben duoi, tu
  // dong bao gom quyen moi nay) - day la moi quan tam van hanh/ha tang, khong phai nghiep vu, nen
  // KHONG dua vao danh sach Manager/Employee.
  SYSTEM_MANAGE: 'system:manage',

  // 15/09/2026: Lich cong ty (HRM-lite mo rong, theo yeu cau GVHD) - thiet lap ngay le/su kien
  // dung chung toan to chuc. Mirror dung SYSTEM_MANAGE ngay tren: 1 quyen DUY NHAT cho ca xem lan
  // quan ly (khong tach CALENDAR_VIEW rieng) vi trang nay dat trong khu vuc Quan tri (chi Org
  // Admin thay duoc) - xem General_idea.md muc 4 ("Org Admin" la vai tro quan tri DUY NHAT thuc su
  // ton tai). Chi Org Admin duoc cap (qua DEFAULT_ROLE_PERMISSIONS.ORG_ADMIN ben duoi), KHONG dua
  // vao danh sach Manager/Employee - ngay le/su kien cong ty la thiet lap cap to chuc, khong phai
  // nghiep vu hang ngay cua tung phong ban.
  CALENDAR_MANAGE: 'calendar:manage',

  // 22/09/2026: giai trinh/duyet cham cong va dang ky/duyet tang ca (HRM-lite mo rong) - mirror
  // dung nhom 3 quyen LEAVE_REQUEST_CREATE/VIEW/APPROVE o tren (nhan vien tu tao yeu cau, Manager
  // xem toan bo + duyet).
  ATTENDANCE_ADJUSTMENT_CREATE: 'attendance_adjustment:create',
  ATTENDANCE_ADJUSTMENT_VIEW: 'attendance_adjustment:view',
  ATTENDANCE_ADJUSTMENT_APPROVE: 'attendance_adjustment:approve',
  OVERTIME_REQUEST_CREATE: 'overtime_request:create',
  OVERTIME_REQUEST_VIEW: 'overtime_request:view',
  OVERTIME_REQUEST_APPROVE: 'overtime_request:approve',
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
    // 24/09/2026: Manager duoc xem Phat hien bat thuong cua PHONG BAN minh phu trach (xem gioi
    // han pham vi tai apps/ml-service - mirror dung cach Manager duoc ANALYTICS_VIEW ngay tren).
    PERMISSIONS.ML_VIEW,
    PERMISSIONS.USER_INVITE,
    // 04/08/2026: CRM-lite - Manager quan ly toan bo khach hang/deal, mirror dung nhom quyen
    // Project (CRUD day du) vi Customer la thuc the "cap cao" tuong tu Project.
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.CUSTOMER_DELETE,
    PERMISSIONS.DEAL_VIEW,
    PERMISSIONS.DEAL_CREATE,
    PERMISSIONS.DEAL_UPDATE,
    PERMISSIONS.DEAL_DELETE,
    // 05/08/2026: HRM-lite - Manager tu cham cong/xin nghi phep cho chinh minh NHU MOI nhan vien
    // khac (ATTENDANCE_CHECKIN/LEAVE_REQUEST_CREATE), cong them quyen xem toan to chuc + duyet
    // nghi phep (ATTENDANCE_VIEW/LEAVE_REQUEST_VIEW/LEAVE_REQUEST_APPROVE) ma Employee khong co.
    PERMISSIONS.ATTENDANCE_CHECKIN,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.LEAVE_REQUEST_CREATE,
    PERMISSIONS.LEAVE_REQUEST_VIEW,
    PERMISSIONS.LEAVE_REQUEST_APPROVE,
    // 22/09/2026: Manager tu giai trinh/dang ky NHU MOI nhan vien khac, cong them quyen xem toan
    // to chuc + duyet (mirror dung ly do voi nhom LEAVE_REQUEST ngay tren).
    PERMISSIONS.ATTENDANCE_ADJUSTMENT_CREATE,
    PERMISSIONS.ATTENDANCE_ADJUSTMENT_VIEW,
    PERMISSIONS.ATTENDANCE_ADJUSTMENT_APPROVE,
    PERMISSIONS.OVERTIME_REQUEST_CREATE,
    PERMISSIONS.OVERTIME_REQUEST_VIEW,
    PERMISSIONS.OVERTIME_REQUEST_APPROVE,
  ],
  [DefaultRoleName.EMPLOYEE]: [
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_VIEW,
    PERMISSIONS.DOCUMENT_SHARE,
    // 04/08/2026: CRM-lite - Employee (nhan vien sale) chi xem duoc danh sach khach hang (khong
    // tao/sua/xoa Customer - viec quan ly danh muc khach hang thuoc Manager), nhung duoc tu tao/
    // cap nhat Deal cua minh, mirror dung nhom quyen Task (create/update/view, khong delete).
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.DEAL_CREATE,
    PERMISSIONS.DEAL_UPDATE,
    PERMISSIONS.DEAL_VIEW,
    // 05/08/2026: HRM-lite - Employee tu cham cong (che do photo-proof) va tu tao yeu cau nghi
    // phep cho chinh minh; KHONG xem duoc du lieu toan to chuc/duyet nghi phep (thuoc Manager).
    PERMISSIONS.ATTENDANCE_CHECKIN,
    PERMISSIONS.LEAVE_REQUEST_CREATE,
    // 22/09/2026: Employee tu giai trinh cham cong sai/dang ky tang ca cho chinh minh; KHONG xem
    // duoc du lieu toan to chuc/duyet (thuoc Manager) - mirror dung LEAVE_REQUEST_CREATE ngay tren.
    PERMISSIONS.ATTENDANCE_ADJUSTMENT_CREATE,
    PERMISSIONS.OVERTIME_REQUEST_CREATE,
  ],
};
