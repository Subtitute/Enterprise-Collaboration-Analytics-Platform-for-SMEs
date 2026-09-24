import { apiClient } from '@/lib/api-client';
import { unwrapList } from '@/lib/utils';
import type {
  AiInsightsResult,
  AnomaliesResult,
  AnomalyItem,
  DateRangeOption,
  DocumentActivityPoint,
  DrillDownResult,
  DrillDownScope,
  ProjectProgressItem,
} from '@/types';

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
// de tranh ton han ngach Gemini/Groq API mien phi (xem ly do day du tai AnalyticsPage.tsx).
// 22/09/2026: thiet ke lai - AI tu quet TOAN BO to chuc (moi phong ban + top du an), khong con
// khai niem "loc theo 1 phong ban" o tang API nay nua (xem AiInsightQueryDto, analytics-service).
// 22/09/2026: fallback candidates = [] - ket qua nay di qua cache Redis 30 phut ben backend
// (INSIGHT_CACHE_TTL_SECONDS), nen ngay sau khi trien khai them field "candidates" van co the
// nhan duoc 1 ban ghi cache CU (tao truoc luc trien khai) chua co field nay trong toi da 30 phut.
// Khong guard se lam AiInsightsChart.tsx goi .map() tren undefined va crash trang trang.
// 24/09/2026: Layer 5 - `anomalies` TUY CHON (khong truyen/mang rong = GIU NGUYEN duong GET cu,
// van cache 30 phut ben backend). Co du lieu bat thuong (nguoi dung da bam "Chay phat hien bat
// thuong" truoc do, xem AnomalySection.tsx) -> chuyen sang POST kem theo (bo qua cache, xem
// AiInsightsService.generateInsights()) de AI de xuat them "Ke hoach hanh dong". CO Y bo truong
// `userId` khoi tung phan tu gui di - prompt phia backend KHONG duoc mang danh tinh cu the (xem
// AnomalyInput/buildAnomalyContext() ben backend).
export async function fetchAiInsights(range: DateRangeOption, anomalies: AnomalyItem[] = []): Promise<AiInsightsResult> {
  if (anomalies.length === 0) {
    const { data } = await apiClient.get('/analytics/ai-insights', { params: { range } });
    return { ...data, candidates: data.candidates ?? [] };
  }
  const { data } = await apiClient.post('/analytics/ai-insights', {
    range,
    anomalies: anomalies.map((a) => ({ metrics: a.metrics, topDeviation: a.topDeviation })),
  });
  return { ...data, candidates: data.candidates ?? [] };
}

// 24/09/2026: Layer 2 Diagnostic - bam vao 1 thanh trong AiInsightsChart.tsx (scope/scopeId cua
// chinh StructuredInsight/candidate dang hien thi) se goi endpoint nay - xem
// apps/analytics-service/src/analytics/analytics.service.ts getDrillDown().
export async function fetchDrillDown(scope: DrillDownScope, scopeId: string, range: DateRangeOption): Promise<DrillDownResult> {
  const { data } = await apiClient.get('/analytics/drill-down', { params: { scope, scopeId, range } });
  return data;
}

// 24/09/2026: Layer 3 Anomaly Detection - apps/ml-service (Python/FastAPI, scikit-learn
// IsolationForest THAT). THEO YEU CAU bam nut (khong tu dong) - mirror ly do fetchAiInsights() o
// tren (tranh tinh toan thua). POST (khong phai GET) vi day la 1 hanh dong "chay lai phan tich",
// khong phai doc du lieu da co san.
export async function fetchAnomalies(range: DateRangeOption): Promise<AnomaliesResult> {
  const { data } = await apiClient.post('/ml/anomalies', null, { params: { range } });
  return data;
}
