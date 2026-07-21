import type { ClientRequest, IncomingMessage } from 'http';
import { INTERNAL_AUTH_HEADERS, type JwtAccessPayload } from '@app/common-dto';

type RequestWithUser = IncomingMessage & { user?: JwtAccessPayload };

/** Phai khop voi INTERNAL_SHARED_SECRET_HEADER trong packages/common-guard/src/guards/internal-auth.guard.ts. */
const INTERNAL_SHARED_SECRET_HEADER = 'x-internal-secret';
const DEV_FALLBACK_SECRET = 'dev-shared-secret-change-me';

/**
 * Hook onProxyReq cua http-proxy-middleware: khi req.user da duoc middleware xac thuc JWT
 * gan (xem jwt-auth.middleware.ts), ghi cac header noi bo ma InternalAuthGuard (@app/common-guard)
 * o cac service phia sau se doc - Technical_Spec.md muc 6.
 *
 * Header `x-internal-secret` duoc dinh kem tren MOI request duoc proxy (ke ca route cong khai),
 * de service phia sau co the phan biet request thuc su di qua Gateway voi request goi thang
 * (bo qua Gateway) tu mot client tu khai bao header context de gia mao danh tinh (bo sung 21/07/2026).
 */
export function injectAuthHeaders(proxyReq: ClientRequest, req: IncomingMessage): void {
  proxyReq.setHeader(
    INTERNAL_SHARED_SECRET_HEADER,
    process.env.INTERNAL_SHARED_SECRET ?? DEV_FALLBACK_SECRET,
  );

  const user = (req as RequestWithUser).user;
  if (!user) return;

  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.ORG_ID, user.organizationId);
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.USER_ID, user.sub);
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.EMAIL, user.email);
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.ROLES, (user.roles ?? []).join(','));
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.PERMISSIONS, (user.permissions ?? []).join(','));
}
