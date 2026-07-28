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
export async function fetchAnalyticsSummary(range: DateRangeOption = '30d', departmentId?: string): Promise<AnalyticsSummary> {
  const { data } = await apiClient.get<AnalyticsSummary>('/analytics/summary', {
    params: { range, ...(departmentId ? { departmentId } : {}) },
  });
  return data ?? EMPTY_SUMMARY;
}

// Backend (GET /analytics/task-trend) tra ve { date, tasksCreated, tasksCompleted }[] -
// doi ten sang { date, created, completed } de khop voi TaskTrendChart hien co.
export async function fetchTaskTrend(range: DateRangeOption = '30d'): Promise<TaskTrendPoint[]> {
  const { data } = await apiClient.get('/analytics/task-trend', { params: { range } });
  const rows = unwrapList<{ date: string; tasksCreated: number; tasksCompleted: number }>(data);
  return rows.map((r) => ({ date: r.date, created: r.tasksCreated, completed: r.tasksCompleted }));
}

// Backend tra ve 1 OBJECT { TODO, DOING, DONE } (trang thai hien tai), khong phai mang -
// chuyen sang mang { status, count }[] de khop voi TaskStatusDonut hien co.
// 28/07/2026: them tham so departmentId (tuy chon) cho GET /analytics/task-status-breakdown,
// theo dung pattern spread co dieu kien da co san cua projectId ben duoi.
export async function fetchTaskStatusBreakdown(
  range: DateRangeOption = '30d',
  projectId?: string,
  departmentId?: string,
): Promise<TaskStatusBreakdownItem[]> {
  const { data } = await apiClient.get<{ TODO: number; DOING: number; DONE: number }>(
    '/analytics/task-status-breakdown',
    { params: { range, ...(projectId ? { projectId } : {}), ...(departmentId ? { departmentId } : {}) } },
  );
  const breakdown = data ?? { TODO: 0, DOING: 0, DONE: 0 };
  return (['TODO', 'DOING', 'DONE'] as const).map((status) => ({ status, count: breakdown[status] ?? 0 }));
}

// Backend (GET /analytics/recent-activity) tra ve { eventId, time, eventType, producer, actorId, payload }[] -
// doi ten sang { id, action, createdAt, actorId } de khop voi RecentActivityFeed hien co.
export async function fetchRecentActivity(): Promise<RecentActivityItem[]> {
  const { data } = await apiClient.get('/analytics/recent-activity');
  const rows = unwrapList<{ eventId: string; time: string; eventType: string; actorId: string | null }>(data);
  return rows.map((r) => ({ id: r.eventId, actorId: r.actorId, action: r.eventType, createdAt: r.time }));
}
