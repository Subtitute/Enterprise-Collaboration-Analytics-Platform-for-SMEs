import { useQuery } from '@tanstack/react-query';
import type { DateRangeOption } from '@/types';
import { fetchDocumentActivity, fetchProjectProgress } from './api';

export function useProjectProgressQuery(range: DateRangeOption = '30d') {
  return useQuery({ queryKey: ['analytics', 'project-progress', range], queryFn: () => fetchProjectProgress(range) });
}

export function useDocumentActivityQuery(range: DateRangeOption) {
  return useQuery({ queryKey: ['analytics', 'document-activity', range], queryFn: () => fetchDocumentActivity(range) });
}
