import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { connectNotificationSocket, disconnectNotificationSocket } from '@/lib/socket';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import type { AppNotification } from '@/types';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from './api';
import type { FetchNotificationsParams } from './api';

export function useNotificationsQuery(params: FetchNotificationsParams = {}) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => fetchNotifications(params),
  });
}

export function useUnreadNotificationsPreview() {
  return useNotificationsQuery({ isRead: false, page: 1, limit: 6 });
}

export function useMarkNotificationRead() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (error) => toast.error(t('notifications:toast.updateError'), extractErrorMessage(error)),
  });
}

export function useMarkAllNotificationsRead() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (error) => toast.error(t('notifications:toast.updateError'), extractErrorMessage(error)),
  });
}

/** Ket noi WS thong bao realtime khi da dang nhap; ket noi lai moi khi access token doi (vd sau refresh). */
export function useNotificationSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) {
      disconnectNotificationSocket();
      return;
    }
    const socket = connectNotificationSocket(accessToken);

    const onNew = (notification: AppNotification) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.info(notification.title, notification.message);
    };
    const onUnreadCount = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('notification:new', onNew);
    socket.on('notification:unread-count', onUnreadCount);

    return () => {
      socket.off('notification:new', onNew);
      socket.off('notification:unread-count', onUnreadCount);
    };
  }, [accessToken, queryClient]);
}
