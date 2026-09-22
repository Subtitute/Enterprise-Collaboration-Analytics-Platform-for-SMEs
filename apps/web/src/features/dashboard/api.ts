import { apiClient } from '@/lib/api-client';
import { unwrapList } from '@/lib/utils';
import type { AnalyticsSummary, DateRangeOption, RecentActivityItem, TaskStatusBreakdownItem, TaskTrendPoint } from '@/types';

const EMPTY_SUMMARY: AnalyticsSummary = {
  totalTasksCreated: 0,
  totalTasksCompleted: 0,
  completionRate: 0,
  newDocumentsThisWeek: 0,
  activeUsersLast7Days: 0,
};

// 28/07/2026: them tham so departmentId (tuy chon) cho GET /analytics/summary - chi dua vao
// params khi thuc su duoc chon, giu nguyen hanh vi toan to chuc khi khong loc theo phong ban.
// 16/09/2026: them co che fallback an toan khi gap 403 Forbidden (Employee khong co PERMISSIONS.ANALYTICS_VIEW).
export async function fetchAnalyticsSummary(range: DateRangeOption = '30d', departmentId?: string): Promise<AnalyticsSummary> {
  try {
    const { data } = await apiClient.get<AnalyticsSummary>('/analytics/summary', {
      params: { range, ...(departmentId ? { departmentId } : {}) },
    });
    return data ?? EMPTY_SUMMARY;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 403) {
      return EMPTY_SUMMARY;
    }
    throw err;
  }
}

// Backend (GET /analytics/task-trend) tra ve { date, tasksCreated, tasksCompleted }[] -
// doi ten sang { date, created, completed } de khop voi TaskTrendChart hien co.
// 16/09/2026: bat 403 va tra ve [] de khong hien thi loi cho Employee khong co quyen analytics.
export async function fetchTaskTrend(range: DateRangeOption = '30d'): Promise<TaskTrendPoint[]> {
  try {
    const { data } = await apiClient.get('/analytics/task-trend', { params: { range } });
    const rows = unwrapList<{ date: string; tasksCreated: number; tasksCompleted: number }>(data);
    return rows.map((r) => ({ date: r.date, created: r.tasksCreated, completed: r.tasksCompleted }));
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 403) {
      return [];
    }
    throw err;
  }
}

// Backend tra ve 1 OBJECT { TODO, DOING, DONE } (trang thai hien tai), khong phai mang -
// chuyen sang mang { status, count }[] de khop voi TaskStatusDonut hien co.
// 28/07/2026: them tham so departmentId (tuy chon) cho GET /analytics/task-status-breakdown,
// theo dung pattern spread co dieu kien da co san cua projectId ben duoi.
// 16/09/2026: bat 403 va tra ve mang 0 de khong gay loi cho Employee.
export async function fetchTaskStatusBreakdown(
  range: DateRangeOption = '30d',
  projectId?: string,
  departmentId?: string,
): Promise<TaskStatusBreakdownItem[]> {
  try {
    const { data } = await apiClient.get<{ TODO: number; DOING: number; DONE: number }>(
      '/analytics/task-status-breakdown',
      { params: { range, ...(projectId ? { projectId } : {}), ...(departmentId ? { departmentId } : {}) } },
    );
    const breakdown = data ?? { TODO: 0, DOING: 0, DONE: 0 };
    return (['TODO', 'DOING', 'DONE'] as const).map((status) => ({ status, count: breakdown[status] ?? 0 }));
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 403) {
      return (['TODO', 'DOING', 'DONE'] as const).map((status) => ({ status, count: 0 }));
    }
    throw err;
  }
}

// Backend (GET /analytics/recent-activity) tra ve { eventId, time, eventType, producer, actorId, payload }[] -
// doi ten sang { id, action, createdAt, actorId } de khop voi RecentActivityFeed hien co.
// 16/09/2026: bat 403 va tra ve [] neu Employee khong co quyen xem nhat ky toan to chuc.
export async function fetchRecentActivity(): Promise<RecentActivityItem[]> {
  try {
    const { data } = await apiClient.get('/analytics/recent-activity');
    const rows = unwrapList<{ eventId: string; time: string; eventType: string; actorId: string | null }>(data);
    return rows.map((r) => ({ id: r.eventId, actorId: r.actorId, action: r.eventType, createdAt: r.time }));
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 403) {
      return [];
    }
    throw err;
  }
}

/**
 * Danh sách nghỉ phép sắp tới đã được duyệt:
 * - Ưu tiên gọi GET /leave-requests?status=APPROVED (Manager / Org Admin có PERMISSIONS.LEAVE_REQUEST_VIEW).
 * - Nếu bị 403 Forbidden (Employee thông thường), tự động fallback sang GET /leave-requests/me và lọc các đơn APPROVED.
 */
export async function fetchUpcomingLeaves(): Promise<import('@/types').LeaveRequest[]> {
  try {
    const { data } = await apiClient.get<import('@/types').PaginatedResponse<import('@/types').LeaveRequest>>('/leave-requests', {
      params: { status: 'APPROVED', limit: 30 },
    });
    return unwrapList<import('@/types').LeaveRequest>(data);
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 403) {
      try {
        const { data } = await apiClient.get<import('@/types').PaginatedResponse<import('@/types').LeaveRequest>>('/leave-requests/me', {
          params: { limit: 30 },
        });
        const myItems = unwrapList<import('@/types').LeaveRequest>(data);
        return myItems.filter((item) => item.status === 'APPROVED');
      } catch {
        return [];
      }
    }
    return [];
  }
}
