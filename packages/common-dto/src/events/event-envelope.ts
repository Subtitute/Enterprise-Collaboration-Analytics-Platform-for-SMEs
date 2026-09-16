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
}

export interface TaskCreatedPayload {
  taskId: string;
  projectId: string;
  title: string;
  actorId: string;
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

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  departmentId: string | null;
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

// 28/07/2026: payload cho EVENT_TYPES.USER_DEPARTMENT_CHANGED - xem ghi chu tai event-types.ts.
// `departmentId: null` nghia la user vua bi GO khoi phong ban (khong con thuoc phong ban nao).
export interface UserDepartmentChangedPayload {
  userId: string;
  departmentId: string | null;
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
