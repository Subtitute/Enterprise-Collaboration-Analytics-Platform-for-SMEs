import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import type { AppNotification, PaginatedResponse, VisibilityScope } from '@/types';

export interface FetchNotificationsParams {
  isRead?: boolean;
  /** Loc theo loai thong bao (Task/Document/He thong...) - Wireframe.md muc 6: trang
   *  "Xem tat ca thong bao" co phan trang + filter theo loai. */
  type?: string;
  page?: number;
  limit?: number;
}

const LOCAL_NOTIF_PREFIX = 'ec_user_notifications_';

export function getLocalNotifications(userId: string): AppNotification[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_NOTIF_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalNotification(recipientUserId: string, notification: AppNotification): void {
  try {
    const key = `${LOCAL_NOTIF_PREFIX}${recipientUserId}`;
    const list = getLocalNotifications(recipientUserId);
    // Tránh trùng lặp id
    if (!list.some((n) => n.id === notification.id)) {
      list.unshift(notification);
      // Giới hạn tối đa 50 thông báo local
      localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
      window.dispatchEvent(new Event('ec_notifications_updated'));
    }
  } catch {
    // ignore
  }
}

export type NotificationsResponse = PaginatedResponse<AppNotification> & { scope: VisibilityScope };

// 23/09/2026: bo sung `scope` (yeu cau nguoi dung - the hien ro rang dang xem pham vi nao: toan
// to chuc/phong ban minh phu trach/chi cua minh) - xem NotificationsService.resolveVisibleUserIds().
export async function fetchNotifications(params: FetchNotificationsParams = {}): Promise<NotificationsResponse> {
  let serverData: NotificationsResponse = {
    data: [],
    meta: { page: 1, limit: params.limit ?? 15, total: 0 },
    scope: 'self',
  };
  try {
    const { data } = await apiClient.get<NotificationsResponse>('/notifications', { params });
    serverData = data;
  } catch {
    // Fallback nếu server lỗi hoặc offline
  }

  // Hợp nhất với các thông báo lưu trữ cục bộ của người dùng hiện tại (vd: Task Done -> Notify Manager)
  const currentUserId = useAuthStore.getState().user?.id;
  if (!currentUserId) return serverData;

  const localItems = getLocalNotifications(currentUserId);
  if (localItems.length === 0) return serverData;

  // Lọc local items theo params
  let filteredLocal = localItems;
  if (typeof params.isRead === 'boolean') {
    filteredLocal = filteredLocal.filter((n) => n.isRead === params.isRead);
  }
  if (params.type) {
    filteredLocal = filteredLocal.filter((n) => (n.type || '').toLowerCase() === params.type?.toLowerCase());
  }

  // Kết hợp và loại bỏ trùng lặp id
  const existingIds = new Set(serverData.data.map((n) => n.id));
  const newLocal = filteredLocal.filter((n) => !existingIds.has(n.id));

  const combined = [...newLocal, ...serverData.data].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    data: combined,
    meta: {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      total: serverData.meta.total + newLocal.length,
    },
    scope: serverData.scope,
  };
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const currentUserId = useAuthStore.getState().user?.id;
  if (currentUserId) {
    try {
      const key = `${LOCAL_NOTIF_PREFIX}${currentUserId}`;
      const list = getLocalNotifications(currentUserId);
      const updated = list.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      localStorage.setItem(key, JSON.stringify(updated));
      window.dispatchEvent(new Event('ec_notifications_updated'));
      const found = updated.find((n) => n.id === id);
      if (found) return found;
    } catch {
      // ignore
    }
  }

  const { data } = await apiClient.patch<AppNotification>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  const currentUserId = useAuthStore.getState().user?.id;
  if (currentUserId) {
    try {
      const key = `${LOCAL_NOTIF_PREFIX}${currentUserId}`;
      const list = getLocalNotifications(currentUserId);
      const updated = list.map((n) => ({ ...n, isRead: true }));
      localStorage.setItem(key, JSON.stringify(updated));
      window.dispatchEvent(new Event('ec_notifications_updated'));
    } catch {
      // ignore
    }
  }

  try {
    await apiClient.patch('/notifications/read-all');
  } catch {
    // ignore
  }
}

