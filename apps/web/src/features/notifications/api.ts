import { apiClient } from '@/lib/api-client';
import type { AppNotification, PaginatedResponse } from '@/types';

export interface FetchNotificationsParams {
  isRead?: boolean;
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
