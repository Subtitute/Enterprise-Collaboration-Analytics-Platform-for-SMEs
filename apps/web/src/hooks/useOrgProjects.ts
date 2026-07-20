import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse, Project } from '@/types';

// Analytics Service co tinh khong luu ten du an (chi projectId) - phai join phia client bang
// danh sach du an lay tu Project-Task Service. Limit lon vi to chuc SME thuong khong co qua
// nhieu du an dong thoi.
async function fetchAllProjects(): Promise<Project[]> {
  const { data } = await apiClient.get<PaginatedResponse<Project>>('/projects', { params: { limit: 200 } });
  return data.data;
}

export function useAllProjectsQuery() {
  return useQuery({ queryKey: ['projects', 'all'], queryFn: fetchAllProjects, staleTime: 60_000 });
}

export function useProjectNameMap() {
  const query = useAllProjectsQuery();
  const map: Record<string, string> = {};
  for (const p of query.data ?? []) map[p.id] = p.name;
  return { map, projects: query.data ?? [], ...query };
}
