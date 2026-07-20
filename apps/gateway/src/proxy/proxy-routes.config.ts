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
    prefixes: ['/api/v1/auth', '/api/v1/users', '/api/v1/departments', '/api/v1/roles'],
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
    prefixes: ['/api/v1/notifications'],
    targetConfigKey: 'services.notification',
  },
  {
    prefixes: ['/api/v1/analytics'],
    targetConfigKey: 'services.analytics',
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
