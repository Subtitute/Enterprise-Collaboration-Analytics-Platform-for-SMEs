import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import { t } from '@/i18n';
import type { AnomalyItem, DateRangeOption, DrillDownScope } from '@/types';
import {
  fetchAiInsights,
  fetchAnomalies,
  fetchDocumentActivity,
  fetchDrillDown,
  fetchProductSalesTrend,
  fetchProjectProgress,
  fetchTopProducts,
} from './api';

// 28/07/2026: them tham so departmentId (tuy chon) cho bo loc "Phong ban" tren trang Bao cao &
// Phan tich - dua vao queryKey de moi lua chon phong ban duoc cache rieng.
export function useProjectProgressQuery(range: DateRangeOption = '30d', departmentId?: string) {
  return useQuery({
    queryKey: ['analytics', 'project-progress', range, departmentId ?? null],
    queryFn: () => fetchProjectProgress(range, departmentId),
  });
}

export function useDocumentActivityQuery(range: DateRangeOption) {
  return useQuery({ queryKey: ['analytics', 'document-activity', range], queryFn: () => fetchDocumentActivity(range) });
}

// 28/07/2026: tinh nang "Nhan xet AI" - dung useMutation (khong phai useQuery) vi day la hanh
// dong THEO YEU CAU nguoi dung bam nut, khong tu dong goi khi vao trang (tranh ton han ngach
// Gemini/Groq API mien phi - xem AnalyticsPage.tsx).
// 24/09/2026: nhan them `anomalies` TUY CHON (Layer 5) - xem fetchAiInsights().
export function useAiInsightsMutation() {
  return useMutation({
    mutationFn: ({ range, anomalies }: { range: DateRangeOption; anomalies?: AnomalyItem[] }) =>
      fetchAiInsights(range, anomalies),
    onError: (error) => toast.error(t('analytics:hooks.aiInsightError'), extractErrorMessage(error)),
  });
}

// 24/09/2026: Layer 2 Diagnostic drill-down - cung dung useMutation (khong phai useQuery) mac du
// la 1 GET, giu dung tinh than useAiInsightsMutation() o tren (hanh dong THEO YEU CAU nguoi dung
// bam vao 1 thanh bieu do, khong phai 1 filter thuong truc can auto-refetch).
export function useDrillDownMutation() {
  return useMutation({
    mutationFn: ({ scope, scopeId, range }: { scope: DrillDownScope; scopeId: string; range: DateRangeOption }) =>
      fetchDrillDown(scope, scopeId, range),
    onError: (error) => toast.error(t('analytics:hooks.drillDownError'), extractErrorMessage(error)),
  });
}

// 24/09/2026: Layer 3 Anomaly Detection - cung dung useMutation (hanh dong THEO YEU CAU bam nut),
// mirror useAiInsightsMutation()/useDrillDownMutation() o tren.
export function useAnomaliesMutation() {
  return useMutation({
    mutationFn: (range: DateRangeOption) => fetchAnomalies(range),
    onError: (error) => toast.error(t('analytics:hooks.anomalyError'), extractErrorMessage(error)),
  });
}

// 16/10/2026: khoi "Xu huong thi truong" moi tren trang Bao cao & Phan tich - dung useQuery (tu
// dong goi lai, khong phai hanh dong theo yeu cau nhu useAiInsightsMutation()/useAnomaliesMutation()
// o tren) vi day la 2 bieu do thuong, cung chung bo loc khoang thoi gian (range) co san cua trang,
// mirror dung useProjectProgressQuery()/useDocumentActivityQuery().
export function useProductSalesTrendQuery(range: DateRangeOption = '30d') {
  return useQuery({ queryKey: ['analytics', 'product-sales-trend', range], queryFn: () => fetchProductSalesTrend(range) });
}

export function useTopProductsQuery(range: DateRangeOption = '30d', limit = 5) {
  return useQuery({ queryKey: ['analytics', 'top-products', range, limit], queryFn: () => fetchTopProducts(range, limit) });
}
