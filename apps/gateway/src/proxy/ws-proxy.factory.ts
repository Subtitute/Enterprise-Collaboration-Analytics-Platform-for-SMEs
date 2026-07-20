import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * Proxy cho traffic WebSocket (Socket.IO) - Technical_Spec.md muc 6.
 * KHONG gan header noi bo o day: server WS phia sau tu verify JWT tu handshake (auth.token).
 *
 * pathFilter dang ham (thay vi mount theo path) vi cung ly do voi REST proxy - giu nguyen
 * req.url de pathRewrite tu '^/ws/...' -> '/socket.io' hoat dong dung.
 */
export function createWsServiceProxy(
  prefix: string,
  target: string,
  pathRewrite: Record<string, string>,
): ReturnType<typeof createProxyMiddleware> {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    pathFilter: (pathname) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    pathRewrite,
  });
}
