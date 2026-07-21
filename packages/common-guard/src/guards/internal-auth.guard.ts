import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthContext, INTERNAL_AUTH_HEADERS } from '@app/common-dto';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/** Header mang bi mat chia se giua Gateway va cac service phia sau (Technical_Spec.md muc 6, bo sung 21/07/2026). */
export const INTERNAL_SHARED_SECRET_HEADER = 'x-internal-secret';

/** Fallback dev-only - PHAI duoc ghi de bang bien moi truong INTERNAL_SHARED_SECRET o moi environment thuc. */
const DEV_FALLBACK_SECRET = 'dev-shared-secret-change-me';

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
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();

    const expectedSecret = process.env.INTERNAL_SHARED_SECRET ?? DEV_FALLBACK_SECRET;
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
