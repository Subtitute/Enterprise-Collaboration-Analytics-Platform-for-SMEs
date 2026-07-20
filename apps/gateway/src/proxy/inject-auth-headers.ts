import type { ClientRequest, IncomingMessage } from 'http';
import { INTERNAL_AUTH_HEADERS, type JwtAccessPayload } from '@app/common-dto';

type RequestWithUser = IncomingMessage & { user?: JwtAccessPayload };

/**
 * Hook onProxyReq cua http-proxy-middleware: khi req.user da duoc middleware xac thuc JWT
 * gan (xem jwt-auth.middleware.ts), ghi cac header noi bo ma InternalAuthGuard (@app/common-guard)
 * o cac service phia sau se doc - Technical_Spec.md muc 6.
 */
export function injectAuthHeaders(proxyReq: ClientRequest, req: IncomingMessage): void {
  const user = (req as RequestWithUser).user;
  if (!user) return;

  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.ORG_ID, user.organizationId);
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.USER_ID, user.sub);
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.EMAIL, user.email);
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.ROLES, (user.roles ?? []).join(','));
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.PERMISSIONS, (user.permissions ?? []).join(','));
}
