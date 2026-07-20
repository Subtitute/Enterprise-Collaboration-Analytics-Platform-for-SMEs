import { io, type Socket } from 'socket.io-client';

// Backend contract: io(window.location.origin, { path: '/ws/notifications' | '/ws/analytics', auth: { token } })
// Cac socket nay phai duoc ket noi lai moi khi access token doi (sau khi silent-refresh).

const NOTIFICATION_PATH = import.meta.env.VITE_WS_NOTIFICATION_URL || '/ws/notifications';
const ANALYTICS_PATH = import.meta.env.VITE_WS_ANALYTICS_URL || '/ws/analytics';

let notificationSocket: Socket | null = null;
let analyticsSocket: Socket | null = null;

export function connectNotificationSocket(token: string): Socket {
  notificationSocket?.disconnect();
  notificationSocket = io(window.location.origin, {
    path: NOTIFICATION_PATH,
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return notificationSocket;
}

export function connectAnalyticsSocket(token: string): Socket {
  analyticsSocket?.disconnect();
  analyticsSocket = io(window.location.origin, {
    path: ANALYTICS_PATH,
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return analyticsSocket;
}

export function disconnectNotificationSocket() {
  notificationSocket?.disconnect();
  notificationSocket = null;
}

export function disconnectAnalyticsSocket() {
  analyticsSocket?.disconnect();
  analyticsSocket = null;
}
