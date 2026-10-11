import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse, User } from '@/types';

const EMPTY_USERS: User[] = [];

// Quy mo to chuc muc tieu ~10-200 nhan vien (General_idea.md muc 7) nen lay 1 lan voi limit lon
// la du, tranh goi N+1 khi can join actorId/assignee -> ten nguoi dung o nhieu man hinh khac nhau.
async function fetchAllUsers(): Promise<User[]> {
  const { data } = await apiClient.get<PaginatedResponse<User>>('/users', { params: { limit: 200 } });
  return data.data;
}

// 22/07/2026: them tham so `options.enabled` (mac dinh khong truyen = giu nguyen hanh vi cu, luon
// bat) - can thiet de useGlobalSearch() (Topbar) co the tri hoan query nay toi khi nguoi dung
// thuc su focus o tim kiem, thay vi goi ngay khi Topbar mount o MOI trang (xem useGlobalSearch.ts).
export function useOrgUsersQuery(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['users', 'all'], queryFn: fetchAllUsers, staleTime: 5 * 60_000, enabled: options?.enabled });
}

/** id -> ten hien thi, dung de join actorId/assigneeId... o Analytics, Kanban, Admin. */
export function useUserNameMap() {
  const query = useOrgUsersQuery();
  const users = query.data ?? EMPTY_USERS;
  const map = useMemo(() => {
    const res: Record<string, string> = {};
    for (const u of users) res[u.id] = u.fullName;
    return res;
  }, [users]);
  return { map, users, ...query };
}

