import { useQuery } from '@tanstack/react-query';
import type { DateRangeOption } from '@/types';
import { fetchDocumentActivity, fetchProjectProgress } from './api';

export function useProjectProgressQuery() {
  return useQuery({ queryKey: ['analytics', 'project-progress'], queryFn: fetchProjectProgress });
}

export function useDocumentActivityQuery(range: DateRangeOption) {
  return useQuery({ queryKey: ['analytics', 'document-activity', range], queryFn: () => fetchDocumentActivity(range) });
}
