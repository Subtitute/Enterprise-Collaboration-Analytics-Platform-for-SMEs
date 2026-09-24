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
  organizationName?: string;
  departmentId: string | null;
  roles: Role[];
  // 16/09/2026: "Super Admin" (tinh nang moi) - true CHI VOI tai khoan quan tri nen tang. Dung de
  // dieu huong dung khu vuc (/platform-admin thay vi /dashboard, xem ProtectedRoute.tsx).
  isSuperAdmin: boolean;
}

export interface Organization {
  id: string;
  name: string;
  taxCode?: string | null;
}

// 16/09/2026: "Super Admin" (tinh nang moi) - to chuc (tenant) nhin tu goc do quan tri nen tang,
// KHAC voi `Organization` o tren (thong tin toi thieu 1 user tu doc ve chinh to chuc cua ho).
export interface PlatformOrganization {
  id: string;
  name: string;
  taxCode: string | null;
  isActive: boolean;
  userCount: number;
  createdAt: string;
}

export interface PlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalUsers: number;
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
  // 20/08/2026: field CONG THEM cho rollout i18n (xem
  // packages/common-dto/src/dto/error-response.dto.ts va lib/api-client.ts extractErrorMessage).
  errorCode?: string;
  errorParams?: Record<string, string | number>;
  details?: { code: string; params?: Record<string, string | number> }[];
  // 22/08/2026: field CONG THEM (xem packages/common-dto/src/constants/correlation-id.constant.ts)
  // - chua dung o UI, chi khai bao de khop kieu voi backend; xem Technical_Spec.md ve tracing.
  correlationId?: string;
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
  // 17/09/2026: "Truong phong" that (Department.managerId, backend) - thay cho kieu doan cu o
  // DepartmentsPage.tsx (quet role name chua "lead/manager/admin", co the doan sai).
  managerId?: string | null;
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

// 20/08/2026: TASK_STATUS_LABEL_VI (map tinh, chi tieng Viet) da bo - rollout i18n, dung
// t('projects:enums.taskStatus.'+status) qua useTranslation() thay the (xem
// apps/web/src/i18n/locales/{vi,en,ja}/projects.json).

export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | string;

export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Project {
  id: string;
  organizationId?: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  progress?: number;
  /** % hoan thanh do Project-Task Service tinh san (Dieu chinh 21/07/2026) - uu tien dung
   *  truong nay thay vi tu tinh tu danh sach task khi co san. */
  completionRate?: number;
  /** So thanh vien dang tham gia du an (Dieu chinh 21/07/2026). */
  memberCount?: number;
  /** 26/08/2026 (fix code review, loi MAJOR - Fix 3): truong that tu server (project.entity.ts,
   *  project-task-service) - truoc do "do uu tien"/"nguoi phu trach" chi duoc luu rieng trong
   *  localStorage['ec_projects_metadata'] cua tung trinh duyet (khong dong bo giua nguoi dung/thiet
   *  bi). Optional vi cac ban ghi Project tra ve tu endpoint cu/mock co the chua co 2 truong nay. */
  priority?: ProjectPriority;
  leadUserId?: string | null;
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

/** GET /tasks/:id/status-history - lich su doi trang thai cua 1 task, sap xep tu cu -> moi. */
export interface TaskStatusHistoryEntry {
  fromStatus: TaskStatus | string | null;
  toStatus: TaskStatus | string;
  actorId: string | null;
  changedAt: string;
}

// 28/07/2026: bo sung visibility/createdByUserId - Folder tra ve tu GET /folders gio da co 2
// truong nay (tinh nang kiem soat truy cap thu muc theo cap do to chuc/han che), dung de: (a)
// FolderGrid hien icon khoa cho thu muc 'restricted', (b) so sanh createdByUserId voi id nguoi
// dung dang dang nhap (useAuthStore) de quyet dinh ai duoc doi visibility/quan ly chia se thu muc.
export interface Folder {
  id: string;
  name: string;
  parentId?: string | null;
  visibility: 'organization' | 'restricted';
  createdByUserId: string;
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

// 28/07/2026: kieu du lieu cho FolderShare - khop CHINH XAC voi response cua GET/POST
// /folders/:id/shares (backend contract tinh nang kiem soat truy cap thu muc theo cap do). Chi 1
// trong 2 truong sharedWithUserId/sharedWithDepartmentId co gia tri (truong con lai la null) -
// khac FileShare o tren (chi ho tro chia se theo tung nguoi dung).
export interface FolderShare {
  id: string;
  folderId: string;
  sharedWithUserId: string | null;
  sharedWithDepartmentId: string | null;
  sharedByUserId: string;
  createdAt: string;
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
  payload?: Record<string, unknown>;
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

// 23/09/2026: pham vi hien thi thong bao/hoat dong theo cap do nguoi dung (Org Admin/Manager/
// Employee) - xem NotificationsService.resolveVisibleUserIds() (notification-service) va
// AnalyticsService.getRecentActivity() (analytics-service). Dung chung 1 type FE cho ca 2 tinh
// nang vi cung 3 gia tri/y nghia, du 2 backend dinh nghia doc lap.
export type VisibilityScope = 'organization' | 'department' | 'self';

export type DateRangeOption = '7d' | '30d' | 'quarter';

export const DATE_RANGE_OPTIONS: DateRangeOption[] = ['7d', '30d', 'quarter'];

// 20/08/2026: DATE_RANGE_LABEL_VI (map tinh, chi tieng Viet) da bo - rollout i18n, dung
// t('common:enums.dateRange.'+range) qua useTranslation() thay the.

// 28/07/2026: kieu du lieu cho GET /analytics/ai-insights (tinh nang "Nhan xet AI").
// 22/09/2026: thiet ke lai - thay 1 doan van tu do (AI viet, frontend regex-tach 3 gach dau dong)
// bang mang insight CO CAU TRUC (AI chi xep hang/dien giai, so lieu BACKEND tu tinh - xem
// apps/analytics-service/src/ai-insights/ai-insights.service.ts). Moi insight -> 1 card rieng.
export type InsightSeverity = 'critical' | 'warning' | 'info';
export type InsightScope = 'organization' | 'department' | 'project';

// 24/09/2026: Layer 5 Recommendation Engine - mo rong "Nhan xet AI" (POST /analytics/ai-insights,
// xem AiInsightsService.generateInsights()) de tra ve them "Ke hoach hanh dong" khi request kem
// du lieu Phat hien bat thuong (AnomalyItem[], xem AnomalySection.tsx).
export type ActionPlanPriority = 'high' | 'medium' | 'low';

export interface ActionPlanItem {
  action: string;
  priority: ActionPlanPriority;
  reason: string;
  expectedEffect: string;
  effort: string;
}

export interface StructuredInsight {
  scope: InsightScope;
  /** null khi scope='organization'. UUID tho (departmentId/projectId) - frontend tu resolve ten qua useDepartmentsQuery()/useProjectNameMap(). */
  scopeId: string | null;
  severity: InsightSeverity;
  metric: string;
  headline: string;
  detail: string;
  recommendation: string | null;
  /** null khi AI khong de xuat gi them, HOAC khi goi qua GET (khong kem du lieu bat thuong). */
  actionPlan: ActionPlanItem | null;
  evidence: {
    value: number;
    comparisonValue: number | null;
    unit: 'percent';
  };
}

/** 22/09/2026: TOAN BO pham vi da quet (khong chi 2-4 muc duoc AI chon) - dung de ve bieu do so
 *  sanh day du (xem AiInsightsChart.tsx), cho thay AI da can nhac tren nen du lieu day du. */
export interface AiInsightCandidateSummary {
  scope: InsightScope;
  scopeId: string | null;
  completionRate: number;
}

export interface AiInsightsResult {
  range: string;
  generatedAt: string;
  insights: StructuredInsight[];
  candidates: AiInsightCandidateSummary[];
}

// 24/09/2026: kieu du lieu cho GET /analytics/drill-down (Layer 2 Diagnostic - xem
// apps/analytics-service/src/analytics/analytics.service.ts getDrillDown()). Khac InsightScope o
// tren (khong co 'organization' - drill-down luon can 1 scopeId cu the).
export type DrillDownScope = 'department' | 'project';

export interface DrillDownResult {
  scope: DrillDownScope;
  scopeId: string;
  totalTasks: number;
  notDoneTasks: number;
  overdueTasks: number;
  /** null neu khong co task nao (trong pham vi) dang chua xong co nguoi duoc gan. */
  topAssignee: { userId: string; notDoneTaskCount: number } | null;
}

// 24/09/2026: kieu du lieu cho POST /ml/anomalies (Layer 3 Anomaly Detection - apps/ml-service,
// scikit-learn IsolationForest that). userId la UUID tho (database-per-service, khong resolve ten
// - frontend tu join qua useUserNameMap() nhu cac tinh nang khac).
export type AnomalyMetric = 'completionRate' | 'overdueTasks' | 'attendanceRate';

export interface AnomalyDeviation {
  metric: AnomalyMetric;
  value: number;
  teamAverage: number;
  direction: 'down' | 'up';
}

export interface AnomalyItem {
  userId: string;
  metrics: {
    totalTasks: number;
    completionRate: number;
    overdueTasks: number;
    attendanceRate: number;
  };
  topDeviation: AnomalyDeviation;
}

export interface AnomaliesResult {
  range: string;
  generatedAt: string;
  sampleSize: number;
  anomalies: AnomalyItem[];
}

// 28/07/2026: kieu du lieu cho GET /failed-events (Dead Letter Queue) - Sự kiện xử lý nội bộ
// (Kafka) that bai vinh vien hoac het luot thu lai tu dong, phuc vu man hinh chan doan cho Org
// Admin (features/admin/FailedEventsPage.tsx). CHUA CHAC CHAN backend tra ve "_id" hay "id" cho
// khoa chinh - khai bao ca hai (deu optional) de FE khong vo neu lech, xem ghi chu tai
// features/admin/api.ts (fetchFailedEvents) va FailedEventsPage.tsx ve cach chon truong nao dung.
export type FailedEventErrorType = 'MALFORMED_JSON' | 'INVALID_ENVELOPE' | 'PERMANENT_DATA_ERROR' | 'RETRY_EXHAUSTED';

export interface FailedEvent {
  _id?: string;
  id?: string;
  eventId: string | null;
  eventType: string | null;
  organizationId: string | null;
  sourceService: string;
  sourceTopic: string;
  errorType: FailedEventErrorType;
  errorMessage: string;
  attempts: number;
  rawPayload: string;
  failedAt: string;
  createdAt: string;
}

// 15/09/2026: Lich cong ty (HRM-lite mo rong, theo yeu cau GVHD) - Technical_Spec.md "Lich cong ty".
export type CalendarEventType = 'HOLIDAY' | 'EVENT';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  type: CalendarEventType;
  startDate: string;
  endDate: string;
  createdByUserId: string;
  createdAt: string;
}

// 04/08/2026: CRM-lite (khach hang, co hoi ban hang) - Technical_Spec.md muc 16.
export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
  ownerUserId: string;
  /** So deal DANG hoat dong (chua WON/LOST) - GET /customers tra ve tinh gop san. */
  openDealCount?: number;
  openDealValue?: number;
  createdAt: string;
  updatedAt: string;
}

export type DealStage = 'NEW' | 'CONTACTED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';

export const DEAL_STAGES: DealStage[] = ['NEW', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

// 20/08/2026: DEAL_STAGE_LABEL_VI (map tinh, chi tieng Viet) da bo - rollout i18n, dung
// t('crm:enums.dealStage.'+stage) qua useTranslation() thay the.

export interface Deal {
  id: string;
  customerId: string;
  title: string;
  value: number;
  stage: DealStage;
  expectedCloseDate?: string | null;
  closedAt?: string | null;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

// 05/08/2026: HRM-lite (cham cong photo-proof, nghi phep) - Technical_Spec.md muc 17.
export interface Attendance {
  id: string;
  userId: string;
  workDate: string;
  checkInAt: string;
  // 13/08/2026: co "on-site"/"off-site" - null = khong co du lieu de danh gia (thieu quyen vi
  // tri hoac toa do van phong chua cau hinh), KHAC voi false (co toa do, ngoai ban kinh van
  // phong). Chi la tin hieu THEM cho Manager doi chieu, khong phai co che chan cham cong - xem
  // Technical_Spec.md muc 17.
  checkInIsOnSite?: boolean | null;
  checkOutAt?: string | null;
  checkOutIsOnSite?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// 20/08/2026: LEAVE_REQUEST_STATUS_LABEL_VI (map tinh, chi tieng Viet) da bo - rollout i18n, dung
// t('hrm:enums.leaveRequestStatus.'+status) qua useTranslation() thay the.

export interface LeaveRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveRequestStatus;
  approverId?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 22/09/2026: giai trinh cham cong va dang ky tang ca (HRM-lite mo rong) - thay the du lieu gia
// lap bang localStorage truoc day (xem apps/hrm-service/src/entities/attendance-adjustment.entity.ts,
// overtime-request.entity.ts). Cung quy uoc "review metadata" voi LeaveRequest o tren
// (approverId/decisionNote/decidedAt).
export type AttendanceAdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AttendanceAdjustment {
  id: string;
  attendanceId: string;
  userId: string;
  workDate: string;
  originalCheckInAt?: string | null;
  originalCheckOutAt?: string | null;
  proposedCheckInAt: string;
  proposedCheckOutAt: string;
  reason: string;
  status: AttendanceAdjustmentStatus;
  approverId?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OvertimeMultiplierType = 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';
export type OvertimeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface OvertimeRequest {
  id: string;
  userId: string;
  workDate: string;
  otStart: string;
  otEnd: string;
  multiplierType: OvertimeMultiplierType;
  multiplier: number;
  estimatedHours: number;
  reason: string;
  status: OvertimeRequestStatus;
  approverId?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
