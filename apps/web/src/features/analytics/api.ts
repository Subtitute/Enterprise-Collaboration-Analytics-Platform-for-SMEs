import { apiClient } from '@/lib/api-client';
import { unwrapList } from '@/lib/utils';
import type { AiInsight, DateRangeOption, DocumentActivityPoint, ProjectProgressItem } from '@/types';

// Analytics Service co tinh khong luu ten du an (chi projectId) - features/analytics/AnalyticsPage.tsx
// se join voi src/hooks/useOrgProjects.ts (GET /projects) de hien thi ten thay vi id tho.
// Backend tra ve { projectId, tasksCreated, tasksCompleted, completionRate }[] - doi ten sang
// { projectId, totalTasks, completedTasks, progress } de khop voi ProjectProgressChart/Table hien co.
// 28/07/2026: them tham so departmentId (tuy chon) cho GET /analytics/project-progress, theo dung
// pattern spread co dieu kien cua fetchTaskStatusBreakdown (features/dashboard/api.ts).
export async function fetchProjectProgress(range: DateRangeOption = '30d', departmentId?: string): Promise<ProjectProgressItem[]> {
  const { data } = await apiClient.get('/analytics/project-progress', {
    params: { range, ...(departmentId ? { departmentId } : {}) },
  });
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

// 28/07/2026: tinh nang "Nhan xet AI" - theo yeu cau (nut bam), khong tu dong goi khi vao trang,
// de tranh ton han ngach Gemini API mien phi (xem ly do day du tai AnalyticsPage.tsx). `departmentName`
// CHI de hien thi trong doan van AI sinh ra (backend khong tu resolve duoc ten - xem
// AiInsightQueryDto), KHONG anh huong logic loc/truy van (van dung departmentId).
export async function fetchAiInsight(
  range: DateRangeOption,
  departmentId?: string,
  departmentName?: string,
): Promise<AiInsight> {
  const { data } = await apiClient.get('/analytics/ai-insights', {
    params: { range, ...(departmentId ? { departmentId, departmentName } : {}) },
  });
  return data;
}
