/**
 * Bang dinh tuyen reverse proxy cua Gateway - Technical_Spec.md muc 6.
 * targetConfigKey la duong dan dot-path toi configuration.ts (vd 'services.iam').
 */

export interface RestProxyRouteGroup {
  prefixes: string[];
  targetConfigKey: string;
  // 03/10/2026: tuy chon ghi de thoi gian cho proxy (ms) - mac dinh dung PROXY_TIMEOUT_MS chung
  // (30s, rest-proxy.factory.ts) neu khong dat. Phat hien qua rieng soat: 30s chung cho MOI route
  // la qua gat gao voi tai len/tai xuong file lon (document-service) va bao cao/suy luan ML nang
  // (analytics/ml-service) - 1 request CHAM nhung VAN khoe manh (khong hang that) se bi huy giua
  // chung, tra ve 502 oan uong cho nguoi dung dang cho ket qua binh thuong.
  timeoutMs?: number;
}

/** Thoi gian cho rieng cho cac route co the hop ly mat >30s (tai file lon, bao cao/suy luan ML). */
const EXTENDED_PROXY_TIMEOUT_MS = 120_000;

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
    timeoutMs: EXTENDED_PROXY_TIMEOUT_MS, // tai len/tai xuong file lon co the hop ly mat hon 30s
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
    timeoutMs: EXTENDED_PROXY_TIMEOUT_MS, // "Nhan xet AI"/bao cao tong hop co the mat hon 30s
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
  {
    // 24/09/2026: ML Service (Layer 3 Anomaly Detection, Technical_Spec.md muc 19) - service
    // Python/FastAPI dau tien cua du an, van la 1 muc trong bang dinh tuyen nay giong het cac
    // service Node khac (Gateway khong phan biet ngon ngu backend, chi proxy HTTP thuan).
    prefixes: ['/api/v1/ml'],
    targetConfigKey: 'services.ml',
    timeoutMs: EXTENDED_PROXY_TIMEOUT_MS, // IsolationForest tren toan to chuc co the mat hon 30s
  },
  {
    // 28/09/2026: Messaging Service (nhan tin noi bo 1:1 va nhom/kenh).
    prefixes: ['/api/v1/conversations'],
    targetConfigKey: 'services.messaging',
  },
  {
    // 15/10/2026: Inventory Service (Danh muc san pham + Kho, gan giao dich khach hang de phan
    // tich xu huong thi truong - Technical_Spec.md muc 22).
    prefixes: ['/api/v1/product-categories', '/api/v1/products', '/api/v1/warehouses', '/api/v1/stock', '/api/v1/stock-movements', '/api/v1/customer-purchases'],
    targetConfigKey: 'services.inventory',
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
  {
    // 28/09/2026: Messaging Service - mirror y het '/ws/notifications' o tren.
    prefix: '/ws/messaging',
    targetConfigKey: 'services.messaging',
    pathRewrite: { '^/ws/messaging': '/socket.io' },
  },
];
