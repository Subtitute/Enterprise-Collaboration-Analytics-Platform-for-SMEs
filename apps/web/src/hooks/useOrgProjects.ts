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

// 22/07/2026: them tham so `options.enabled` (mac dinh khong truyen = giu nguyen hanh vi cu, luon
// bat) - can thiet de useGlobalSearch() (Topbar) co the tri hoan query nay toi khi nguoi dung
// thuc su focus o tim kiem, thay vi goi ngay khi Topbar mount o MOI trang (xem useGlobalSearch.ts).
export function useAllProjectsQuery(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['projects', 'all'], queryFn: fetchAllProjects, staleTime: 60_000, enabled: options?.enabled });
}

export function useProjectNameMap() {
  const query = useAllProjectsQuery();
  const map: Record<string, string> = {};
  for (const p of query.data ?? []) map[p.id] = p.name;
  return { map, projects: query.data ?? [], ...query };
}
