import { apiClient } from '@/lib/api-client';
import type { User } from '@/types';

/** Ho so ca nhan tai su dung GET /users/:id (IAM) da co san - moi thanh vien da xac thuc trong
 *  to chuc co the tu xem chinh minh (khong bi chan boi RequirePermissions, xem
 *  apps/iam-service/src/users/users.controller.ts). Khong them endpoint /me rieng. */
export async function fetchUser(id: string): Promise<User> {
  const { data } = await apiClient.get<User>(`/users/${id}`);
  return data;
}
