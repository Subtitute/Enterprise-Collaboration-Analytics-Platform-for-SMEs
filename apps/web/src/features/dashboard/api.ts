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

export async function fetchAnalyticsSummary(range: DateRangeOption = '30d'): Promise<AnalyticsSummary> {
  const { data } = await apiClient.get<AnalyticsSummary>('/analytics/summary', { params: { range } });
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
export async function fetchTaskStatusBreakdown(
  range: DateRangeOption = '30d',
  projectId?: string,
): Promise<TaskStatusBreakdownItem[]> {
  const { data } = await apiClient.get<{ TODO: number; DOING: number; DONE: number }>(
    '/analytics/task-status-breakdown',
    { params: { range, ...(projectId ? { projectId } : {}) } },
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
