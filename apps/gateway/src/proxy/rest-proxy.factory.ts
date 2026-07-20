import { createProxyMiddleware } from 'http-proxy-middleware';
import { injectAuthHeaders } from './inject-auth-headers';
import { matchesPrefix } from './path-match.util';

/**
 * Tao proxy cho mot nhom tien to REST (vd /api/v1/auth, /api/v1/users, ...) toi 1 target.
 *
 * Mount tai goc (app.use(proxy), KHONG app.use(prefix, proxy)) va tu loc duong dan bang
 * pathFilter dang ham - vi Express se cat bo doan prefix khoi req.url khi mount theo path,
 * pha vo tinh chat "path-preserving" cua proxy (downstream can nguyen /api/v1/... trong URL).
 */
export function createServiceProxy(prefixes: string[], target: string): ReturnType<typeof createProxyMiddleware> {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter: (pathname) => matchesPrefix(pathname, prefixes),
    on: {
      proxyReq: injectAuthHeaders,
    },
  });
}
