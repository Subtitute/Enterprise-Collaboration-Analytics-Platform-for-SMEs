/**
 * Bang dinh tuyen reverse proxy cua Gateway - Technical_Spec.md muc 6.
 * targetConfigKey la duong dan dot-path toi configuration.ts (vd 'services.iam').
 */

export interface RestProxyRouteGroup {
  prefixes: string[];
  targetConfigKey: string;
}

export const REST_PROXY_ROUTES: RestProxyRouteGroup[] = [
  {
    // 16/09/2026: them '/api/v1/platform-admin' (tinh nang moi "Super Admin") - cung iam-service,
    // noi giu Organization/User (xem platform-admin module).
    prefixes: ['/api/v1/auth', '/api/v1/users', '/api/v1/departments', '/api/v1/roles', '/api/v1/platform-admin'],
    targetConfigKey: 'services.iam',
  },
  {
    prefixes: ['/api/v1/projects', '/api/v1/tasks'],
    targetConfigKey: 'services.projectTask',
  },
  {
    prefixes: ['/api/v1/folders', '/api/v1/files'],
    targetConfigKey: 'services.document',
  },
  {
    // 28/07/2026: them '/api/v1/failed-events' (nang cap Dead Letter Queue) - endpoint quan tri
    // moi (chi Org Admin, PERMISSIONS.SYSTEM_MANAGE) xem danh sach event xu ly loi vinh vien,
    // dat trong Notification Service (noi da co MongoDB + la service "cac trang quan tri xem
    // thong tin he thong" - xem failed-events module).
    prefixes: ['/api/v1/notifications', '/api/v1/failed-events'],
    targetConfigKey: 'services.notification',
  },
  {
    prefixes: ['/api/v1/analytics'],
    targetConfigKey: 'services.analytics',
  },
  {
    // 04/08/2026: CRM-lite Service (Technical_Spec.md muc 16).
    prefixes: ['/api/v1/customers', '/api/v1/deals'],
    targetConfigKey: 'services.crm',
  },
  {
    // 05/08/2026: HRM-lite Service (Technical_Spec.md muc 17).
    // 15/09/2026: them '/api/v1/calendar-events' (Lich cong ty, cung service hrm-service).
    // 22/09/2026: them '/api/v1/attendance-adjustments', '/api/v1/overtime-requests' (giai
    // trinh/duyet cham cong, dang ky/duyet tang ca) va '/api/v1/leave-policy' (chinh sach nghi
    // phep theo Luat LD VN) - ca 3 deu la endpoint MOI cung hrm-service, thieu prefix o day se
    // khien Gateway tra 404 "Cannot GET/POST ..." du service da co san route (phat hien qua smoke
    // test thu cong sau khi rebuild Docker - danh sach prefix nay PHAI duoc cap nhat THU CONG moi
    // khi hrm-service co prefix route moi, khong tu dong suy ra tu controller).
    prefixes: [
      '/api/v1/attendance',
      '/api/v1/leave-requests',
      '/api/v1/calendar-events',
      '/api/v1/attendance-adjustments',
      '/api/v1/overtime-requests',
      '/api/v1/leave-policy',
    ],
    targetConfigKey: 'services.hrm',
  },
];

export interface WsProxyRoute {
  prefix: string;
  targetConfigKey: string;
  pathRewrite: Record<string, string>;
}

export const WS_PROXY_ROUTES: WsProxyRoute[] = [
  {
    prefix: '/ws/notifications',
    targetConfigKey: 'services.notification',
    pathRewrite: { '^/ws/notifications': '/socket.io' },
  },
  {
    prefix: '/ws/analytics',
    targetConfigKey: 'services.analytics',
    pathRewrite: { '^/ws/analytics': '/socket.io' },
  },
];
