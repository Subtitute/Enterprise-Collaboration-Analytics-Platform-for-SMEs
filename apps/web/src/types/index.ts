// Kieu du lieu dung chung, phan anh "Backend contract" (Technical_Spec.md muc 6-7).
// Cac endpoint Analytics tra ve truong id "tho" (projectId, actorId...) va co the co them
// truong tuy service - vi vay nhieu kieu duoi day duoc khai bao "mo" ([key: string]: unknown)
// de UI khong vo (crash) neu backend dat ten truong khac di chut it; cac component doc du
// lieu qua ham trich xuat phong thu (an toan voi undefined) thay vi truy cap truc tiep.

export interface Role {
  id: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  departmentId: string | null;
  roles: Role[];
}

export interface Organization {
  id: string;
  name: string;
  taxCode?: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorShape {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

/** Nguoi dung tra ve tu IAM Service (GET /users), khac voi AuthUser (ngu canh JWT da giai ma). */
export interface User {
  id: string;
  email: string;
  fullName: string;
  departmentId?: string | null;
  departmentName?: string;
  roles?: Role[];
  isActive?: boolean;
  createdAt?: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string | null;
  organizationId?: string;
  memberCount?: number;
}

export interface Permission {
  key: string;
  description?: string;
  group?: string;
}

export interface RoleWithPermissions extends Role {
  permissionKeys: string[];
}

export type TaskStatus = 'TODO' | 'DOING' | 'DONE';

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'DOING', 'DONE'];

export const TASK_STATUS_LABEL_VI: Record<TaskStatus, string> = {
  TODO: 'Cần làm',
  DOING: 'Đang làm',
  DONE: 'Hoàn thành',
};

export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | string;

export interface Project {
  id: string;
  organizationId?: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  progress?: number;
  startDate?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignee {
  userId: string;
  fullName?: string;
  email?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  dueDate?: string | null;
  assignees?: TaskAssignee[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName?: string;
  content: string;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FileItem {
  id: string;
  name: string;
  folderId: string | null;
  size?: number;
  mimeType?: string;
  version?: number;
  uploadedByName?: string;
  uploadedBy?: string;
  versions?: FileVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface FileShare {
  id: string;
  fileId: string;
  sharedWithUserId: string;
  permission: 'VIEW' | 'EDIT' | string;
}

export interface FileVersion {
  id: string;
  version: number;
  createdAt: string;
  uploadedByName?: string;
  size?: number;
}

export type NotificationType = 'TASK' | 'DOCUMENT' | 'PROJECT' | 'SYSTEM' | string;

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type?: NotificationType;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

// Cac interface duoi day khop CHINH XAC voi response cua Analytics Service
// (apps/analytics-service/src/analytics/analytics.service.ts) - xem ghi chu tai cac ham
// fetch* trong features/dashboard/api.ts va features/analytics/api.ts de biet cach quy doi.
export interface AnalyticsSummary {
  totalTasksCreated: number;
  totalTasksCompleted: number;
  completionRate: number;
  newDocumentsThisWeek: number;
  activeUsersLast7Days: number;
}

export interface TaskTrendPoint {
  date: string;
  created: number;
  completed: number;
}

export interface TaskStatusBreakdownItem {
  status: string;
  count: number;
}

export interface DocumentActivityPoint {
  date: string;
  uploads: number;
  shares: number;
}

export interface ProjectProgressItem {
  projectId: string;
  progress: number;
  completedTasks: number;
  totalTasks: number;
}

export interface RecentActivityItem {
  id: string;
  actorId: string | null;
  action: string;
  createdAt: string;
}

export type DateRangeOption = '7d' | '30d' | 'quarter';

export const DATE_RANGE_LABEL_VI: Record<DateRangeOption, string> = {
  '7d': '7 ngày qua',
  '30d': '30 ngày qua',
  quarter: 'Quý này',
};
