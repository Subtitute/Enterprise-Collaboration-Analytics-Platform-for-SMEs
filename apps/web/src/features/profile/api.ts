import { apiClient } from '@/lib/api-client';
import type { User } from '@/types';

/** Ho so ca nhan tai su dung GET /users/:id (IAM) da co san - moi thanh vien da xac thuc trong
 *  to chuc co the tu xem chinh minh (khong bi chan boi RequirePermissions, xem
 *  apps/iam-service/src/users/users.controller.ts). Khong them endpoint /me rieng. */
export async function fetchUser(id: string): Promise<User> {
  const { data } = await apiClient.get<User>(`/users/${id}`);
  return data;
}

// 26/10/2026: ho so that (Technical_Spec.md muc 27.6) - thay so dien thoai co dinh/nut Luu gia lap/
// avatar chi xem truoc bang API that. `target` = uuid hoac 'me'.
export async function updateMyPhone(phoneNumber: string | null): Promise<User> {
  const { data } = await apiClient.patch<User>('/users/me', { phoneNumber });
  return data;
}

export async function uploadAvatar(target: string, avatar: Blob): Promise<User> {
  const form = new FormData();
  form.append('avatar', avatar, 'avatar.jpg');
  const { data } = await apiClient.put<User>(`/users/${target}/avatar`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data;
}

export async function deleteAvatar(target: string): Promise<User> {
  const { data } = await apiClient.delete<User>(`/users/${target}/avatar`);
  return data;
}

// 26/10/2026: doi mat khau that (thay nut gia lap) - server thu hoi moi phien dang nhap sau khi doi.
export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.patch('/users/me/password', { currentPassword, newPassword });
}
