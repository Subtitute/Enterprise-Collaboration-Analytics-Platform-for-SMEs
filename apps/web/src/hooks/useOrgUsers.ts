import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse, User } from '@/types';

// Quy mo to chuc muc tieu ~10-200 nhan vien (General_idea.md muc 7) nen lay 1 lan voi limit lon
// la du, tranh goi N+1 khi can join actorId/assignee -> ten nguoi dung o nhieu man hinh khac nhau.
async function fetchAllUsers(): Promise<User[]> {
  const { data } = await apiClient.get<PaginatedResponse<User>>('/users', { params: { limit: 200 } });
  return data.data;
}

export function useOrgUsersQuery() {
  return useQuery({ queryKey: ['users', 'all'], queryFn: fetchAllUsers, staleTime: 5 * 60_000 });
}

/** id -> ten hien thi, dung de join actorId/assigneeId... o Analytics, Kanban, Admin. */
export function useUserNameMap() {
  const query = useOrgUsersQuery();
  const map: Record<string, string> = {};
  for (const u of query.data ?? []) map[u.id] = u.fullName;
  return { map, users: query.data ?? [], ...query };
}
