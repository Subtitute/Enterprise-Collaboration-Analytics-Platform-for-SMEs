import { EventType } from './event-types';

/**
 * Schema su kien chuan cho toan bo Kafka event backbone.
 * Nguon: Technical_Spec.md muc 4.3 - Schema su kien chuan (JSON).
 *
 * `occurredAt` LUON la ISO-8601 UTC. Tang hien thi (Dashboard) tu quy doi sang GMT+7
 * (xem ClaudeRule.md muc 4 va Technical_Spec.md dau trang).
 */
export interface DomainEvent<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: EventType | string;
  occurredAt: string;
  organizationId: string;
  producer: string;
  payload: TPayload;
}

export interface TaskStatusChangedPayload {
  taskId: string;
  projectId: string;
  fromStatus: string;
  toStatus: string;
  actorId: string;
  /**
   * 22/09/2026: nguoi phu trach du an (Project.leadUserId) tai thoi diem phat event - dinh kem san
   * de Notification Service resolve nguoi nhan thong bao "Task chuyen sang Done" ma khong can tra
   * cuu xuyen DB cua Project-Task Service (database-per-service - xem event-notification-builder.ts).
   * `null` neu du an chua co nguoi phu trach.
   */
  leadUserId?: string | null;
}

export interface TaskCreatedPayload {
  taskId: string;
  projectId: string;
  title: string;
  actorId: string;
  /**
   * 24/09/2026: han hoan thanh (Task.dueDate) tai thoi diem TAO task - dinh kem san de Analytics
   * Service tinh "qua han" (fact_task_events.due_date) ma khong can goi HTTP xuyen service. GIOI
   * HAN DA BIET: chi phan anh dueDate luc tao, KHONG cap nhat neu doi han sau qua PATCH /tasks/:id
   * (PATCH thuong khong phat event rieng cho thay doi field, xem tasks.service.ts). `null` neu task
   * khong co han.
   */
  dueDate: string | null;
}

export interface TaskAssignedPayload {
  taskId: string;
  projectId: string;
  assigneeId: string;
  actorId: string;
}

export interface ProjectCreatedPayload {
  projectId: string;
  name: string;
  actorId: string;
}

export interface ProjectCompletedPayload {
  projectId: string;
  actorId: string;
}

export interface TaskDeletedPayload {
  taskId: string;
  projectId: string;
  actorId: string;
}

export interface ProjectDeletedPayload {
  projectId: string;
  actorId: string;
}

export interface DocumentUploadedPayload {
  fileId: string;
  folderId: string | null;
  fileName: string;
  actorId: string;
}

export interface DocumentSharedPayload {
  fileId: string;
  sharedWithUserId: string;
  actorId: string;
}

export interface DocumentDeletedPayload {
  fileId: string;
  actorId: string;
}

// 23/09/2026: bo sung actorId (bang chinh userId - nguoi "gia nhap to chuc" la chu the cua hanh
// dong nay, du tu dang ky hay duoc moi) - cung ly do voi UserDepartmentChangedPayload.actorId:
// Analytics Service hien thi "Hoat dong gan day" dung ten thay vi "Mot thanh vien" khong ro danh
// tinh (xem RecentActivityFeed.tsx, actions.iam_user_registered).
export interface UserRegisteredPayload {
  userId: string;
  email: string;
  departmentId: string | null;
  actorId: string;
}

export interface OrganizationRegisteredPayload {
  organizationId: string;
  name: string;
  ownerUserId: string;
}

export interface UserDeactivatedPayload {
  userId: string;
  actorId: string;
}

/** 25/09/2026: xem chu thich EVENT_TYPES.USER_DELETED - phat khi UsersService.remove() xoa cung. */
export interface UserDeletedPayload {
  userId: string;
  actorId: string;
}

// 28/07/2026: payload cho EVENT_TYPES.USER_DEPARTMENT_CHANGED - xem ghi chu tai event-types.ts.
// `departmentId: null` nghia la user vua bi GO khoi phong ban (khong con thuoc phong ban nao).
// 23/09/2026: bo sung actorId (nguoi THUC HIEN thay doi, vd Org Admin goi PATCH /users/:id) - de
// Analytics Service hien thi dung "Hoat dong gan day" thay vi "Mot thanh vien" khong ro danh tinh
// (xem RecentActivityFeed.tsx). `null` danh cho truong hop THAT SU khong co actor con nguoi -
// UserDepartmentSyncService phat lai (resync) event nay TU DONG moi luc iam-service khoi dong,
// khong phai do 1 nguoi vua thao tac.
export interface UserDepartmentChangedPayload {
  userId: string;
  departmentId: string | null;
  actorId: string | null;
}

// 23/09/2026: payload cho EVENT_TYPES.DEPARTMENT_MANAGER_CHANGED - xem ghi chu tai event-types.ts.
// actorId luon co gia tri (khac UserDepartmentChangedPayload o tren) - khong co buoc resync tu
// dong nao cho su kien nay, chi phat khi 1 Org Admin THAT SU tao/sua phong ban qua API.
export interface DepartmentManagerChangedPayload {
  departmentId: string;
  managerId: string | null;
  actorId: string;
}

// 04/08/2026: CRM-lite Service (Technical_Spec.md muc 16).
export interface CustomerCreatedPayload {
  customerId: string;
  name: string;
  actorId: string;
}

export interface CustomerDeletedPayload {
  customerId: string;
  actorId: string;
}

export interface DealCreatedPayload {
  dealId: string;
  customerId: string;
  title: string;
  actorId: string;
}

/**
 * Notification Service phan ung dac biet khi `toStage === DealStage.WON` (thong bao thang deal) -
 * khong tach thanh event rieng DEAL_WON de tranh phinh to danh sach event type cho 1 truong hop cu
 * the cua stage-change chung (dung cach doc payload thay vi them event type moi, mirror tinh than
 * toi gian - ClaudeRule.md muc 8).
 */
export interface DealStageChangedPayload {
  dealId: string;
  customerId: string;
  fromStage: string;
  toStage: string;
  actorId: string;
}

export interface DealDeletedPayload {
  dealId: string;
  customerId: string;
  actorId: string;
}

// 05/08/2026: HRM-lite Service (Technical_Spec.md muc 17).
export interface AttendanceCheckedInPayload {
  attendanceId: string;
  userId: string;
  workDate: string;
}

export interface AttendanceCheckedOutPayload {
  attendanceId: string;
  userId: string;
  workDate: string;
}

export interface LeaveRequestCreatedPayload {
  leaveRequestId: string;
  userId: string;
  startDate: string;
  endDate: string;
}

/** `actorId` la nguoi DUYET (approver), khac `userId` (nguoi xin nghi) - Notification Service can ca 2. */
export interface LeaveRequestApprovedPayload {
  leaveRequestId: string;
  userId: string;
  actorId: string;
}

export interface LeaveRequestRejectedPayload {
  leaveRequestId: string;
  userId: string;
  actorId: string;
}

/**
 * 15/09/2026: Lich cong ty (HRM-lite mo rong). `type` la CalendarEventType (HOLIDAY|EVENT) -
 * khong import truc tiep enum de tranh vong lap phu thuoc trong file event schema thuan tuy nay
 * (mirror cach DealStageChangedPayload ben tren dung `string` cho `toStage`/`fromStage` thay vi
 * import DealStage).
 */
export interface CalendarEventCreatedPayload {
  calendarEventId: string;
  title: string;
  type: string;
  startDate: string;
  endDate: string;
  actorId: string;
}

export interface CalendarEventDeletedPayload {
  calendarEventId: string;
  title: string;
  actorId: string;
}

// 22/09/2026: giai trinh/duyet cham cong va tang ca (HRM-lite mo rong). `actorId` la nguoi DUYET
// (approver), khac `userId` (nguoi gui yeu cau) - mirror dung LeaveRequestApprovedPayload/
// LeaveRequestRejectedPayload o tren.
export interface AttendanceAdjustmentApprovedPayload {
  attendanceAdjustmentId: string;
  userId: string;
  actorId: string;
}

export interface AttendanceAdjustmentRejectedPayload {
  attendanceAdjustmentId: string;
  userId: string;
  actorId: string;
}

export interface OvertimeRequestApprovedPayload {
  overtimeRequestId: string;
  userId: string;
  actorId: string;
}

export interface OvertimeRequestRejectedPayload {
  overtimeRequestId: string;
  userId: string;
  actorId: string;
}

// 15/10/2026: Inventory Service (Danh muc san pham + Kho, Technical_Spec.md muc 22).
export interface ProductCreatedPayload {
  productId: string;
  categoryId: string;
  name: string;
  actorId: string;
}

export interface ProductDeletedPayload {
  productId: string;
  actorId: string;
}

/**
 * Su kien QUAN TRONG NHAT cua tinh nang nay - Analytics Service tieu thu de ghi vao hypertable
 * `fact_product_sales` (schema-bootstrap.ts), phuc vu phan tich xu huong thi truong (san pham ban
 * chay, doanh thu theo thoi gian/danh muc/khach hang). `unitPrice` la gia TAI THOI DIEM giao dich
 * (CustomerPurchase.unitPriceAtPurchase - snapshot, KHONG doc lai Product.unitPrice hien tai co
 * the da thay doi sau do) - dam bao bao cao lich su chinh xac du gia san pham thay doi theo thoi
 * gian. `customerId` thuoc database rieng cua CRM-lite Service - microservice khong dung FK xuyen
 * service/DB (mirror Deal.customerId).
 */
export interface CustomerPurchaseCreatedPayload {
  purchaseId: string;
  customerId: string;
  productId: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
  purchasedAt: string;
  actorId: string;
}

export interface CustomerPurchaseDeletedPayload {
  purchaseId: string;
  productId: string;
  actorId: string;
}
