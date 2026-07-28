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
