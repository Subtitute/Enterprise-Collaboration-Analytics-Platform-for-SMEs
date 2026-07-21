import { apiClient } from '@/lib/api-client';
import type { AppNotification, PaginatedResponse } from '@/types';

export interface FetchNotificationsParams {
  isRead?: boolean;
  /** Loc theo loai thong bao (Task/Document/He thong...) - Wireframe.md muc 6: trang
   *  "Xem tat ca thong bao" co phan trang + filter theo loai. */
  type?: string;
  page?: number;
  limit?: number;
}

export async function fetchNotifications(params: FetchNotificationsParams = {}): Promise<PaginatedResponse<AppNotification>> {
  const { data } = await apiClient.get<PaginatedResponse<AppNotification>>('/notifications', { params });
  return data;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const { data } = await apiClient.patch<AppNotification>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all');
}
