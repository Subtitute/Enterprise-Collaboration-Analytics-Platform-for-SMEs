import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AuthContext,
  DEV_FALLBACK_INTERNAL_SHARED_SECRET,
  INTERNAL_AUTH_HEADERS,
  INTERNAL_SHARED_SECRET_HEADER,
} from '@app/common-dto';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// 22/07/2026: hang so header/fallback truoc day khai bao rieng tai day (trung lap y het voi
// apps/gateway/src/proxy/inject-auth-headers.ts) nay gop vao @app/common-dto - xem
// packages/common-dto/src/constants/internal-shared-secret.constant.ts. Re-export lai
// INTERNAL_SHARED_SECRET_HEADER de khong phai sua import trong internal-auth.guard.spec.ts.
export { INTERNAL_SHARED_SECRET_HEADER };

const logger = new Logger('InternalAuthGuard');

// 22/07/2026: co dinh module-level de Logger.warn ben duoi chi ban ra 1 LAN duy nhat cho ca
// vong doi process (dev/test), thay vi spam log tren MOI request toi service.
let hasWarnedDevFallbackUsage = false;

/**
 * Xac dinh gia tri bi mat noi bo ma Guard nay se doi khop - phat hien qua code review toan du
 * an (22/07/2026): truoc day dung `process.env.INTERNAL_SHARED_SECRET ?? DEV_FALLBACK_SECRET`
 * ngay trong canActivate() - neu quen thiet lap bien moi truong nay o production, service VAN
 * khoi dong binh thuong va am tham chap nhan MOI request ky bang chuoi
 * 'dev-shared-secret-change-me' (da cong khai trong ma nguon git) - fail OPEN thay vi fail
 * CLOSED, vo hieu hoa toan bo lop bao ve "request phai di qua Gateway" (xem class-doc ben duoi).
 *
 * Xu ly: production (NODE_ENV=production) ma thieu bien moi truong -> nem loi NGAY o
 * constructor (Nest se khong khoi dong duoc service, thay vi am tham fail-open luc runtime).
 * Ngoai production (dev/test/NODE_ENV chua dat) -> giu nguyen hanh vi fallback nhu cu de khong
 * pha vo trai nghiem dev cuc bo, nhung Logger.warn 1 lan de dev khong vo tinh bo sot.
 */
function resolveExpectedInternalSecret(): string {
  const envSecret = process.env.INTERNAL_SHARED_SECRET;
  if (envSecret) return envSecret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'INTERNAL_SHARED_SECRET chua duoc thiet lap trong moi truong production - tu choi khoi ' +
        'dong service de tranh fail-open vao gia tri fallback dev da cong khai trong ma nguon.',
    );
  }

  if (!hasWarnedDevFallbackUsage) {
    logger.warn(
      'INTERNAL_SHARED_SECRET chua duoc thiet lap - dang dung gia tri fallback CHI DANH CHO ' +
        'DEV (khong an toan, da cong khai trong ma nguon). Tuyet doi khong dung trong production.',
    );
    hasWarnedDevFallbackUsage = true;
  }
  return DEV_FALLBACK_INTERNAL_SHARED_SECRET;
}

/**
 * Guard dung o TAT CA service phia sau Gateway (IAM, Project-Task, Document,
 * Notification, Analytics). KHONG tu verify JWT - tin tuong header noi bo do
 * API Gateway forward sau khi da verify JWT (Technical_Spec.md muc 6).
 *
 * Bien gioi tin cay: cac service nay chi duoc dat trong internal-net, khong
 * expose truc tiep ra ngoai (xem docker-compose.yml). De phong truong hop mot
 * client bo qua Gateway va goi thang vao service (tu khai bao header context de
 * gia mao danh tinh), guard bat buoc kiem tra header `x-internal-secret` khop
 * voi bi mat chia se qua bien moi truong INTERNAL_SHARED_SECRET truoc khi tin
 * BAT KY header context nao (bo sung 21/07/2026).
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  // 22/07/2026: doi khop duoc giai quyet 1 LAN duy nhat luc Nest khoi tao Guard (thay vi doc
  // lai process.env moi request) de loi thieu INTERNAL_SHARED_SECRET o production duoc phat
  // hien NGAY luc khoi dong service (fail-fast), khong phai cho toi request dau tien.
  private readonly expectedSecret: string = resolveExpectedInternalSecret();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();

    const expectedSecret = this.expectedSecret;
    const providedSecret = readHeader(req.headers[INTERNAL_SHARED_SECRET_HEADER]);
    if (!providedSecret || providedSecret !== expectedSecret) {
      throw new UnauthorizedException(
        'Thieu hoac sai internal shared-secret - yeu cau phai di qua API Gateway',
      );
    }

    const userId = readHeader(req.headers[INTERNAL_AUTH_HEADERS.USER_ID]);
    const organizationId = readHeader(req.headers[INTERNAL_AUTH_HEADERS.ORG_ID]);

    if (!userId || !organizationId) {
      throw new UnauthorizedException(
        'Thieu thong tin xac thuc noi bo - yeu cau phai di qua API Gateway',
      );
    }

    const authContext: AuthContext = {
      userId,
      organizationId,
      email: readHeader(req.headers[INTERNAL_AUTH_HEADERS.EMAIL]) ?? '',
      roles: parseListHeader(req.headers[INTERNAL_AUTH_HEADERS.ROLES]),
      permissions: parseListHeader(req.headers[INTERNAL_AUTH_HEADERS.PERMISSIONS]),
    };
    req.user = authContext;
    return true;
  }
}

function readHeader(value: unknown): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : String(value);
}

function parseListHeader(value: unknown): string[] {
  const raw = readHeader(value);
  if (!raw) return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}
