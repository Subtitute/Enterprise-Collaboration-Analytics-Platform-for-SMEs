import { useQuery } from '@tanstack/react-query';
import type { DateRangeOption } from '@/types';
import { fetchDocumentActivity, fetchProjectProgress } from './api';

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
