import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import type { DateRangeOption } from '@/types';
import { fetchAiInsight, fetchDocumentActivity, fetchProjectProgress } from './api';

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
// Gemini API mien phi - xem AnalyticsPage.tsx).
export function useAiInsightMutation() {
  return useMutation({
    mutationFn: ({ range, departmentId, departmentName }: { range: DateRangeOption; departmentId?: string; departmentName?: string }) =>
      fetchAiInsight(range, departmentId, departmentName),
    onError: (error) => toast.error('Không thể tạo nhận xét AI', extractErrorMessage(error)),
  });
}
