import { apiClient } from '@/lib/api-client';
import { unwrapList } from '@/lib/utils';
import type { DateRangeOption, DocumentActivityPoint, ProjectProgressItem } from '@/types';

// Analytics Service co tinh khong luu ten du an (chi projectId) - features/analytics/AnalyticsPage.tsx
// se join voi src/hooks/useOrgProjects.ts (GET /projects) de hien thi ten thay vi id tho.
// Backend tra ve { projectId, tasksCreated, tasksCompleted, completionRate }[] - doi ten sang
// { projectId, totalTasks, completedTasks, progress } de khop voi ProjectProgressChart/Table hien co.
export async function fetchProjectProgress(): Promise<ProjectProgressItem[]> {
  const { data } = await apiClient.get('/analytics/project-progress');
  const rows = unwrapList<{
    projectId: string;
    tasksCreated: number;
    tasksCompleted: number;
    completionRate: number;
  }>(data);
  return rows.map((r) => ({
    projectId: r.projectId,
    totalTasks: r.tasksCreated,
    completedTasks: r.tasksCompleted,
    progress: r.completionRate,
  }));
}

// Backend tra ve { date, filesUploaded, filesShared }[] (khong co khai niem "tai xuong") -
// doi ten sang { date, uploads, shares } de khop voi DocumentActivityChart hien co.
export async function fetchDocumentActivity(range: DateRangeOption = '30d'): Promise<DocumentActivityPoint[]> {
  const { data } = await apiClient.get('/analytics/document-activity', { params: { range } });
  const rows = unwrapList<{ date: string; filesUploaded: number; filesShared: number }>(data);
  return rows.map((r) => ({ date: r.date, uploads: r.filesUploaded, shares: r.filesShared }));
}
