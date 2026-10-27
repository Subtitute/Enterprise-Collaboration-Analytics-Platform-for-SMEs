/**
 * Kafka topic va event type constants dung chung cho toan bo nen tang.
 * Nguon: Technical_Spec.md muc 4.2 (chuan dat ten topic) va muc 3 (event moi service phat ra).
 * Moi thay doi o day anh huong den TAT CA producer/consumer - sua can dong bo ca 6 service.
 */

export const KAFKA_TOPICS = {
  IAM: 'iam.events',
  PROJECT_TASK: 'project-task.events',
  DOCUMENT: 'document.events',
  // 28/07/2026: topic Dead Letter Queue (nang cap sau MVP - xem Technical_Spec.md muc 14 "Kafka
  // consumer chua co DLQ", nay da co) - noi analytics-service/notification-service tu phat lai
  // (khong phai OutboxPublisherJob cua producer goc) message ma chinh no xu ly that bai vinh vien
  // (loi du lieu) hoac het luot retry (loi ha tang lap lai qua nhieu lan) - xem DeadLetterEnvelope.
  DLQ: 'domain-events.dlq',
  // 04/08/2026: CRM-lite Service (Technical_Spec.md muc 16).
  CRM: 'crm.events',
  // 05/08/2026: HRM-lite Service (Technical_Spec.md muc 17).
  HRM: 'hrm.events',
  // 15/10/2026: Inventory Service (Danh muc san pham + Kho, Technical_Spec.md muc 22).
  INVENTORY: 'inventory.events',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

export const EVENT_TYPES = {
  // IAM Service (Technical_Spec.md muc 3.2)
  ORGANIZATION_REGISTERED: 'iam.organization.registered',
  USER_REGISTERED: 'iam.user.registered',
  USER_DEACTIVATED: 'iam.user.deactivated',
  // 25/09/2026: xoa vinh vien (UsersService.remove(), chi cho phep sau khi da deactivate()) - khac
  // 2 event tren, event nay THUC SU can duoc cac service tieu thu xu ly (khong chi de audit): moi
  // service tu xay read-model rieng qua Kafka (dim_user o Analytics Service, apps/ml-service) se
  // giu "user ma" vinh vien neu khong biet user da bi xoa cung ben IAM Service - phat hien qua
  // phan hoi thuc te (Anomaly Detection hien UUID tho thay vi ten cho nhan vien da bi xoa).
  USER_DELETED: 'iam.user.deleted',
  // 28/07/2026: nang cap KPI theo phong ban - Analytics Service can biet phong ban HIEN TAI cua
  // moi user de gop KPI theo phong ban (xem UserDepartmentChangedPayload, event-envelope.ts).
  // USER_REGISTERED da mang san departmentId luc tao moi (UserRegisteredPayload), nhung truoc day
  // KHONG co event nao phat khi departmentId cua 1 user ĐÃ TỒN TẠI thay doi qua PATCH /users/:id.
  USER_DEPARTMENT_CHANGED: 'iam.user.department_changed',
  // 23/09/2026: pham vi hien thi thong bao theo phong ban (Notification Service/Analytics Service
  // can biet AI dang phu trach phong ban nao - xem Department.managerId) - truoc day thay doi
  // managerId cua 1 phong ban KHONG phat event nao ca (DepartmentsService khong co OutboxService).
  // `managerId: null` nghia la phong ban vua bi go nguoi phu trach.
  DEPARTMENT_MANAGER_CHANGED: 'iam.department.manager_changed',
  // 26/10/2026: danh sach nhan vien & kho anh nhan dien (Technical_Spec.md muc 27.4). profile_updated
  // CHI mang ten truong da doi (khong bao gio gia tri so dien thoai/anh - gioi han muc dich muc 27.3);
  // roles_changed mang muc vai tro (RoleLevel) de ml-service biet "Manager chi duoc thao tac Employee".
  USER_PROFILE_UPDATED: 'iam.user.profile_updated',
  USER_ROLES_CHANGED: 'iam.user.roles_changed',
  // 26/10/2026: kich hoat lai tai khoan - truoc day reactivate() khong phat gi nen ml-service khong biet
  // user da hoat dong lai (co active trong dim_user, chan tai anh ho cho tai khoan dang bi vo hieu hoa).
  USER_REACTIVATED: 'iam.user.reactivated',

  // Project & Task Service (Technical_Spec.md muc 3.3)
  TASK_CREATED: 'task.created',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_ASSIGNED: 'task.assigned',
  TASK_DELETED: 'task.deleted',
  PROJECT_CREATED: 'project.created',
  PROJECT_COMPLETED: 'project.completed',
  PROJECT_DELETED: 'project.deleted',
  // 26/10/2026: tai lieu theo pham vi du an - Document Service tu dung read-model "ai thuoc du an
  // nao" (khong doc DB cua Project-Task Service), nen moi thay doi thanh vien/nguoi phu trach phai
  // phat su kien qua outbox. Truoc day addMember/removeMember/doi leadUserId khong phat gi ca.
  PROJECT_MEMBER_ADDED: 'project.member_added',
  PROJECT_MEMBER_REMOVED: 'project.member_removed',
  PROJECT_LEAD_CHANGED: 'project.lead_changed',

  // Document Service (Technical_Spec.md muc 3.4)
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_SHARED: 'document.shared',
  DOCUMENT_DELETED: 'document.deleted',

  // CRM-lite Service (bo sung 04/08/2026, Technical_Spec.md muc 16)
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_DELETED: 'customer.deleted',
  DEAL_CREATED: 'deal.created',
  DEAL_STAGE_CHANGED: 'deal.stage_changed',
  DEAL_DELETED: 'deal.deleted',

  // HRM-lite Service (bo sung 05/08/2026, Technical_Spec.md muc 17)
  ATTENDANCE_CHECKED_IN: 'attendance.checked_in',
  ATTENDANCE_CHECKED_OUT: 'attendance.checked_out',
  LEAVE_REQUEST_CREATED: 'leave_request.created',
  LEAVE_REQUEST_APPROVED: 'leave_request.approved',
  LEAVE_REQUEST_REJECTED: 'leave_request.rejected',

  // 15/09/2026: Lich cong ty (HRM-lite mo rong, theo yeu cau GVHD) - mirror CUSTOMER_CREATED/
  // DELETED (khong co UPDATED - toan bo entity khac trong repo cung khong phat event cho thao tac
  // sua, chi CREATE/DELETE, giu nhat quan).
  CALENDAR_EVENT_CREATED: 'calendar_event.created',
  CALENDAR_EVENT_DELETED: 'calendar_event.deleted',

  // 22/09/2026: giai trinh/duyet cham cong va tang ca (HRM-lite mo rong) - mirror dung
  // LEAVE_REQUEST_APPROVED/REJECTED (chi phat khi co QUYET DINH, khong phat luc tao yeu cau -
  // nguoi nhan thong bao ro rang la nguoi gui yeu cau).
  ATTENDANCE_ADJUSTMENT_APPROVED: 'attendance_adjustment.approved',
  ATTENDANCE_ADJUSTMENT_REJECTED: 'attendance_adjustment.rejected',
  OVERTIME_REQUEST_APPROVED: 'overtime_request.approved',
  OVERTIME_REQUEST_REJECTED: 'overtime_request.rejected',

  // 15/10/2026: Inventory Service (Danh muc san pham + Kho, Technical_Spec.md muc 22) - mirror
  // CUSTOMER_CREATED/DELETED (khong co UPDATED, dung quy uoc chung cua du an - chi CREATE/DELETE
  // phat event, thao tac sua khong phat). CUSTOMER_PURCHASE_CREATED la su kien QUAN TRONG NHAT cua
  // tinh nang nay - Analytics Service tieu thu de dung fact_product_sales (schema-bootstrap.ts),
  // phuc vu phan tich xu huong thi truong (san pham ban chay, doanh thu theo thoi gian/danh muc).
  PRODUCT_CREATED: 'product.created',
  PRODUCT_DELETED: 'product.deleted',
  CUSTOMER_PURCHASE_CREATED: 'customer_purchase.created',
  CUSTOMER_PURCHASE_DELETED: 'customer_purchase.deleted',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

/** Anh xa event type -> topic tuong ung, dung boi OutboxPublisherJob cua tung service. */
export const EVENT_TYPE_TOPIC_MAP: Record<EventType, KafkaTopic> = {
  [EVENT_TYPES.ORGANIZATION_REGISTERED]: KAFKA_TOPICS.IAM,
  [EVENT_TYPES.USER_REGISTERED]: KAFKA_TOPICS.IAM,
  [EVENT_TYPES.USER_DEACTIVATED]: KAFKA_TOPICS.IAM,
  [EVENT_TYPES.USER_DELETED]: KAFKA_TOPICS.IAM,
  [EVENT_TYPES.USER_DEPARTMENT_CHANGED]: KAFKA_TOPICS.IAM,
  [EVENT_TYPES.DEPARTMENT_MANAGER_CHANGED]: KAFKA_TOPICS.IAM,
  [EVENT_TYPES.USER_PROFILE_UPDATED]: KAFKA_TOPICS.IAM,
  [EVENT_TYPES.USER_ROLES_CHANGED]: KAFKA_TOPICS.IAM,
  [EVENT_TYPES.USER_REACTIVATED]: KAFKA_TOPICS.IAM,

  [EVENT_TYPES.TASK_CREATED]: KAFKA_TOPICS.PROJECT_TASK,
  [EVENT_TYPES.TASK_STATUS_CHANGED]: KAFKA_TOPICS.PROJECT_TASK,
  [EVENT_TYPES.TASK_ASSIGNED]: KAFKA_TOPICS.PROJECT_TASK,
  [EVENT_TYPES.TASK_DELETED]: KAFKA_TOPICS.PROJECT_TASK,
  [EVENT_TYPES.PROJECT_CREATED]: KAFKA_TOPICS.PROJECT_TASK,
  [EVENT_TYPES.PROJECT_COMPLETED]: KAFKA_TOPICS.PROJECT_TASK,
  [EVENT_TYPES.PROJECT_DELETED]: KAFKA_TOPICS.PROJECT_TASK,
  // 26/10/2026: tai lieu theo pham vi du an - xem chu thich tai EVENT_TYPES.PROJECT_MEMBER_ADDED.
  [EVENT_TYPES.PROJECT_MEMBER_ADDED]: KAFKA_TOPICS.PROJECT_TASK,
  [EVENT_TYPES.PROJECT_MEMBER_REMOVED]: KAFKA_TOPICS.PROJECT_TASK,
  [EVENT_TYPES.PROJECT_LEAD_CHANGED]: KAFKA_TOPICS.PROJECT_TASK,

  [EVENT_TYPES.DOCUMENT_UPLOADED]: KAFKA_TOPICS.DOCUMENT,
  [EVENT_TYPES.DOCUMENT_SHARED]: KAFKA_TOPICS.DOCUMENT,
  [EVENT_TYPES.DOCUMENT_DELETED]: KAFKA_TOPICS.DOCUMENT,

  [EVENT_TYPES.CUSTOMER_CREATED]: KAFKA_TOPICS.CRM,
  [EVENT_TYPES.CUSTOMER_DELETED]: KAFKA_TOPICS.CRM,
  [EVENT_TYPES.DEAL_CREATED]: KAFKA_TOPICS.CRM,
  [EVENT_TYPES.DEAL_STAGE_CHANGED]: KAFKA_TOPICS.CRM,
  [EVENT_TYPES.DEAL_DELETED]: KAFKA_TOPICS.CRM,

  [EVENT_TYPES.ATTENDANCE_CHECKED_IN]: KAFKA_TOPICS.HRM,
  [EVENT_TYPES.ATTENDANCE_CHECKED_OUT]: KAFKA_TOPICS.HRM,
  [EVENT_TYPES.LEAVE_REQUEST_CREATED]: KAFKA_TOPICS.HRM,
  [EVENT_TYPES.LEAVE_REQUEST_APPROVED]: KAFKA_TOPICS.HRM,
  [EVENT_TYPES.LEAVE_REQUEST_REJECTED]: KAFKA_TOPICS.HRM,
  [EVENT_TYPES.CALENDAR_EVENT_CREATED]: KAFKA_TOPICS.HRM,
  [EVENT_TYPES.CALENDAR_EVENT_DELETED]: KAFKA_TOPICS.HRM,
  [EVENT_TYPES.ATTENDANCE_ADJUSTMENT_APPROVED]: KAFKA_TOPICS.HRM,
  [EVENT_TYPES.ATTENDANCE_ADJUSTMENT_REJECTED]: KAFKA_TOPICS.HRM,
  [EVENT_TYPES.OVERTIME_REQUEST_APPROVED]: KAFKA_TOPICS.HRM,
  [EVENT_TYPES.OVERTIME_REQUEST_REJECTED]: KAFKA_TOPICS.HRM,

  [EVENT_TYPES.PRODUCT_CREATED]: KAFKA_TOPICS.INVENTORY,
  [EVENT_TYPES.PRODUCT_DELETED]: KAFKA_TOPICS.INVENTORY,
  [EVENT_TYPES.CUSTOMER_PURCHASE_CREATED]: KAFKA_TOPICS.INVENTORY,
  [EVENT_TYPES.CUSTOMER_PURCHASE_DELETED]: KAFKA_TOPICS.INVENTORY,
};

/** Consumer group id chuan - moi service subscribe dung 1 group rieng de nhan du 3 topic. */
export const KAFKA_CONSUMER_GROUPS = {
  NOTIFICATION_SERVICE: 'notification-service-group',
  ANALYTICS_SERVICE: 'analytics-service-group',
  // 28/07/2026: group RIENG cho consumer doc topic DLQ (KAFKA_TOPICS.DLQ) trong notification-service
  // - khac voi NOTIFICATION_SERVICE o tren (doc 3 topic domain event goc) vi day la 1 Consumer
  // instance khac, doc 1 topic khac, voi hinh dang message khac (DeadLetterEnvelope, khong phai
  // DomainEvent) - gop chung 1 group/consumer se lam 2 luong xu ly khac nhau tranh nhau partition.
  NOTIFICATION_SERVICE_DLQ: 'notification-service-dlq-group',
  // 24/09/2026: apps/ml-service (Python/aiokafka, KHONG import duoc package TS nay xuyen ngon
  // ngu) - gia tri chuoi nay duoc COPY THU CONG vao app/kafka_consumer.py cua ml-service, giu o
  // day chi de tai lieu hoa/dong bo quy uoc dat ten. Sua 1 trong 2 noi PHAI sua noi con lai.
  ML_SERVICE: 'ml-service-group',
  // 26/10/2026: Document Service lan dau tieu thu Kafka - read-model thanh vien du an + phong ban
  // cua user, phuc vu tai lieu theo pham vi du an (apps/document-service/src/project-scope).
  DOCUMENT_SERVICE: 'document-service-group',
  // 26/10/2026: pham vi du lieu cua Manager theo phong ban - 3 service nay tu dung read-model
  // user -> phong ban (bang dim_user rieng, chi doc topic iam.events) de biet "thanh vien phong ban
  // cua Manager" ma khong goi HTTP xuyen service (xem src/user-directory cua tung service).
  PROJECT_TASK_SERVICE_DIRECTORY: 'project-task-service-directory-group',
  CRM_SERVICE_DIRECTORY: 'crm-service-directory-group',
  HRM_SERVICE_DIRECTORY: 'hrm-service-directory-group',
} as const;
