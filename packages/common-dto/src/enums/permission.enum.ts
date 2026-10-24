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
  // dung chung toan to chuc. 1 quyen DUY NHAT cho ca xem lan quan ly (khong tach CALENDAR_VIEW
  // rieng).
  //
  // 03/10/2026: mo rong - xem lich (GET) nay da mo cho MOI thanh vien to chuc (khong con doi hoi
  // quyen nay), va Manager cung duoc cap quyen nay (truoc day CHI Org Admin) de lam "co quan ly
  // lich nang cao": tao/sua/xoa ngay nghi le CHINH THUC (CalendarEventType.HOLIDAY), cong them
  // duoc sua/xoa su kien (EVENT) do nguoi co tham quyen THAP HON tao (xem
  // CalendarEventsService - computeCallerCalendarRank()). Employee van tao/sua/xoa duoc EVENT CUA
  // CHINH MINH nhung KHONG duoc cap quyen nay (khong tao/dung vao HOLIDAY, khong dung vao EVENT
  // nguoi khac tao).
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

  // 28/09/2026: Messaging Service (nhan tin noi bo 1:1 va nhom/kenh) - MESSAGE_MANAGE_GROUP tach
  // rieng khoi MESSAGE_SEND vi "them/bot thanh vien nhom" la hanh dong quan tri nhom khac voi "gui
  // tin nhan" (nguoi tao nhom van thao tac duoc nhom cua chinh minh du khong giu quyen nay - xem
  // ConversationsService.updateParticipants() trong apps/messaging-service).
  MESSAGE_VIEW: 'message:view',
  MESSAGE_SEND: 'message:send',
  MESSAGE_MANAGE_GROUP: 'message:manage_group',

  // 15/10/2026: Inventory Service (Danh muc san pham + Kho) - danh muc san pham (Product +
  // ProductCategory) gop 1 nhom quyen (category chi la metadata cua product, khong can tach rieng
  // nhu Customer/Deal von la 2 thuc the nghiep vu doc lap). Kho (Warehouse + WarehouseStock +
  // StockMovement) tach rieng vi la moi quan tam van hanh khac - mirror do rong quyen CALENDAR_MANAGE
  // (1 quyen "quan ly" duy nhat, khong tach CRUD rieng tung hanh dong, dung tinh than toi gian
  // ClaudeRule.md muc 8).
  PRODUCT_VIEW: 'product:view',
  PRODUCT_MANAGE: 'product:manage',
  WAREHOUSE_VIEW: 'warehouse:view',
  WAREHOUSE_MANAGE: 'warehouse:manage',
  // "Gan mat hang cho khach hang" (ghi nhan giao dich) - mirror CHINH XAC do rong quyen Deal (CRM-
  // lite): Employee tu tao/sua giao dich CUA KHACH HANG MINH PHU TRACH, Manager+ CRUD toan bo.
  CUSTOMER_PURCHASE_VIEW: 'customer_purchase:view',
  CUSTOMER_PURCHASE_CREATE: 'customer_purchase:create',
  CUSTOMER_PURCHASE_UPDATE: 'customer_purchase:update',
  CUSTOMER_PURCHASE_DELETE: 'customer_purchase:delete',

  // 24/10/2026: Chat bot noi bo (RAG tai lieu + tool-calling, Technical_Spec.md muc 23) - tien ich
  // ngang hang cho MOI vai tro (mirror tinh than MESSAGE_VIEW/MESSAGE_SEND), khong phai tinh nang
  // quan tri. Quyen nay CHI mo cua chat bot; du lieu bot doc duoc van bi gioi han boi quyen that cua
  // nguoi hoi (moi tool goi lai Gateway bang chinh JWT cua ho - xem apps/analytics-service/src/chatbot).
  CHATBOT_USE: 'chatbot:use',
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
    // 28/09/2026: Messaging Service - Manager quan ly duoc nhom/kenh (them/bot thanh vien) cong
    // them quyen nhan tin co ban, mirror nhom quyen LEAVE_REQUEST (tu thao tac + quyen quan ly rieng).
    PERMISSIONS.MESSAGE_VIEW,
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.MESSAGE_MANAGE_GROUP,
    // 03/10/2026: Lich cong ty - Manager duoc cap "co quan ly lich nang cao" (xem chu thich tai
    // khai bao CALENDAR_MANAGE o tren), truoc day quyen nay CHI Org Admin co.
    PERMISSIONS.CALENDAR_MANAGE,
    // 15/10/2026: Inventory Service - Manager quan ly toan bo danh muc san pham + kho (tao/sua/xoa
    // san pham, danh muc, kho, ghi nhan nhap/xuat kho), cong them CRUD day du giao dich khach hang
    // (mirror nhom quyen Deal ngay tren).
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_MANAGE,
    PERMISSIONS.WAREHOUSE_VIEW,
    PERMISSIONS.WAREHOUSE_MANAGE,
    PERMISSIONS.CUSTOMER_PURCHASE_VIEW,
    PERMISSIONS.CUSTOMER_PURCHASE_CREATE,
    PERMISSIONS.CUSTOMER_PURCHASE_UPDATE,
    PERMISSIONS.CUSTOMER_PURCHASE_DELETE,
    // 24/10/2026: Chat bot noi bo - xem chu thich tai khai bao CHATBOT_USE o tren.
    PERMISSIONS.CHATBOT_USE,
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
    // 28/09/2026: Messaging Service - Employee nhan tin binh thuong (1:1 va trong nhom da duoc
    // them vao) nhung KHONG duoc tu them/bot thanh vien nhom NGUOI KHAC tao (MESSAGE_MANAGE_GROUP
    // thuoc Manager/Org Admin) - rieng nhom DO CHINH Employee do tao, ho van quan ly duoc qua
    // dieu kien createdBy (xem ConversationsService.updateParticipants()), khong can permission nay.
    PERMISSIONS.MESSAGE_VIEW,
    PERMISSIONS.MESSAGE_SEND,
    // 15/10/2026: Inventory Service - Employee (nhan vien sale) chi XEM danh muc san pham/kho
    // (khong quan ly - thuoc Manager, mirror CUSTOMER_VIEW ngay tren), nhung tu ghi nhan/sua duoc
    // giao dich (san pham da ban) CUA KHACH HANG MINH PHU TRACH, mirror CHINH XAC DEAL_CREATE/
    // DEAL_UPDATE/DEAL_VIEW (khong co DELETE, thuoc Manager).
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.WAREHOUSE_VIEW,
    PERMISSIONS.CUSTOMER_PURCHASE_CREATE,
    PERMISSIONS.CUSTOMER_PURCHASE_UPDATE,
    PERMISSIONS.CUSTOMER_PURCHASE_VIEW,
    // 24/10/2026: Chat bot noi bo - xem chu thich tai khai bao CHATBOT_USE o tren.
    PERMISSIONS.CHATBOT_USE,
  ],
};
