import { io, type Socket } from 'socket.io-client';

// Backend contract: io(window.location.origin, { path: '/ws/notifications' | '/ws/analytics', auth: { token } })
// Cac socket nay phai duoc ket noi lai moi khi access token doi (sau khi silent-refresh).

const NOTIFICATION_PATH = import.meta.env.VITE_WS_NOTIFICATION_URL || '/ws/notifications';
const ANALYTICS_PATH = import.meta.env.VITE_WS_ANALYTICS_URL || '/ws/analytics';
// 28/09/2026: Messaging Service - mirror y het NOTIFICATION_PATH/ANALYTICS_PATH o tren (Gateway
// proxy /ws/messaging -> /socket.io, xem apps/gateway/src/proxy/proxy-routes.config.ts).
const MESSAGING_PATH = import.meta.env.VITE_WS_MESSAGING_URL || '/ws/messaging';

let notificationSocket: Socket | null = null;
let analyticsSocket: Socket | null = null;
let messagingSocket: Socket | null = null;

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

export function connectMessagingSocket(token: string): Socket {
  messagingSocket?.disconnect();
  messagingSocket = io(window.location.origin, {
    path: MESSAGING_PATH,
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return messagingSocket;
}

export function disconnectMessagingSocket() {
  messagingSocket?.disconnect();
  messagingSocket = null;
}

/**
 * 28/09/2026: Truy cap socket messaging ĐANG KẾT NỐI (không tạo/kết nối lại) - dùng cho
 * ConversationThread emit joinConversation/leaveConversation của MỘT phòng cụ thể, tách biệt khỏi
 * useMessagingSocket() (kết nối 1 lần duy nhất ở AppShell, mirror useNotificationSocket, để badge
 * ở Sidebar hoạt động trên MỌI trang chứ không chỉ trang Nhắn tin). Gọi connectMessagingSocket()
 * lần thứ 2 ở đây sẽ NGẮT socket cũ (mất toàn bộ listener message:new/conversation:* đã đăng ký ở
 * AppShell) - an toàn vì mọi trang đều được lazy-load (App.tsx) nên luôn có 1 khoảng trễ tải chunk
 * giữa lúc AppShell mount (kết nối socket) và lúc trang con (ConversationsPage) mount xong.
 */
export function getMessagingSocket(): Socket | null {
  return messagingSocket;
}
