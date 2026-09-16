import type { ClientRequest, IncomingMessage } from 'http';
import { Logger } from '@nestjs/common';
import {
  CORRELATION_ID_HEADER,
  DEV_FALLBACK_INTERNAL_SHARED_SECRET,
  INTERNAL_AUTH_HEADERS,
  INTERNAL_SHARED_SECRET_HEADER,
  type JwtAccessPayload,
} from '@app/common-dto';

type RequestWithUser = IncomingMessage & { user?: JwtAccessPayload };

// 22/07/2026: hang so header/fallback truoc day khai bao rieng tai day (trung lap y het voi
// packages/common-guard/src/guards/internal-auth.guard.ts) nay gop vao @app/common-dto - xem
// packages/common-dto/src/constants/internal-shared-secret.constant.ts.

const logger = new Logger('InjectAuthHeaders');

/**
 * Xac dinh gia tri bi mat noi bo Gateway se dong dau len moi request proxy - phat hien qua
 * code review toan du an (22/07/2026): truoc day dung
 * `process.env.INTERNAL_SHARED_SECRET ?? DEV_FALLBACK_SECRET` truc tiep trong injectAuthHeaders()
 * - neu quen thiet lap bien moi truong nay o production, Gateway VAN khoi dong binh thuong va
 * am tham ky MOI request bang chuoi 'dev-shared-secret-change-me' (da cong khai trong ma
 * nguon git) - fail OPEN thay vi fail CLOSED.
 *
 * Xu ly giong het packages/common-guard/src/guards/internal-auth.guard.ts (2 phia cua cung 1
 * bi mat chia se PHAI dong bo hanh vi): production (NODE_ENV=production) ma thieu bien moi
 * truong -> nem loi NGAY luc module nay duoc import (khi setupGateway() dang lap rap cac
 * proxy REST luc khoi dong - xem setup-gateway.ts), khien Gateway khong khoi dong duoc thay vi
 * am tham fail-open luc runtime. Ngoai production -> giu fallback dev-only nhung Logger.warn 1
 * lan (ham nay chi chay 1 lan luc module-load nen khong can co "hasWarned" nhu ban phia guard).
 */
function resolveInternalSharedSecret(): string {
  const envSecret = process.env.INTERNAL_SHARED_SECRET;
  if (envSecret) return envSecret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'INTERNAL_SHARED_SECRET chua duoc thiet lap trong moi truong production - tu choi khoi ' +
        'dong Gateway de tranh fail-open vao gia tri fallback dev da cong khai trong ma nguon.',
    );
  }

  logger.warn(
    'INTERNAL_SHARED_SECRET chua duoc thiet lap - dang dung gia tri fallback CHI DANH CHO ' +
      'DEV (khong an toan, da cong khai trong ma nguon). Tuyet doi khong dung trong production.',
  );
  return DEV_FALLBACK_INTERNAL_SHARED_SECRET;
}

/** Duoc giai quyet 1 lan luc module nay duoc import (xem ly do o resolveInternalSharedSecret). */
const RESOLVED_INTERNAL_SHARED_SECRET = resolveInternalSharedSecret();

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
  proxyReq.setHeader(INTERNAL_SHARED_SECRET_HEADER, RESOLVED_INTERNAL_SHARED_SECRET);

  // 22/08/2026: forward correlation ID (xem correlation-id.middleware.ts, chay truoc middleware
  // nay trong pipeline nen header CHAC CHAN da co gia tri luc toi day) - dong bo tren MOI request
  // duoc proxy, khong phu thuoc trang thai xac thuc, mirror x-internal-secret o tren.
  const correlationId = req.headers?.[CORRELATION_ID_HEADER];
  if (correlationId) {
    proxyReq.setHeader(CORRELATION_ID_HEADER, correlationId);
  }

  const user = (req as RequestWithUser).user;
  if (!user) return;

  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.ORG_ID, user.organizationId);
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.USER_ID, user.sub);
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.EMAIL, user.email);
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.ROLES, (user.roles ?? []).join(','));
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.PERMISSIONS, (user.permissions ?? []).join(','));
  // 28/07/2026: forward departmentId (xem ghi chu tai AuthContext, @app/common-dto) - chi dat
  // header khi co gia tri (khac null/undefined), tranh gui header rong vo nghia cho nguoi dung
  // chua duoc gan phong ban.
  if (user.departmentId) {
    proxyReq.setHeader(INTERNAL_AUTH_HEADERS.DEPARTMENT_ID, user.departmentId);
  }
  // 16/09/2026: "Super Admin" - forward co isSuperAdmin tu JWT (mac dinh false/undefined cho MOI
  // nguoi dung thuong, xem chu thich AuthContext.isSuperAdmin @app/common-dto) de InternalAuthGuard
  // phia sau doc lai dung gia tri.
  proxyReq.setHeader(INTERNAL_AUTH_HEADERS.IS_SUPER_ADMIN, String(user.isSuperAdmin ?? false));
}
