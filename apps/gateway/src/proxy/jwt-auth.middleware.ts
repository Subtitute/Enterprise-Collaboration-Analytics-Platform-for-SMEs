import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { PUBLIC_GATEWAY_ROUTES, type JwtAccessPayload } from '@app/common-dto';
import { sendErrorResponse } from '../common/send-error-response';

/**
 * Cac duong dan KHONG thuoc REST API (/api/v1/...) - hien tai la WebSocket upgrade.
 * Gateway khong xac thuc o day: server WS phia sau tu verify JWT tu Socket.IO handshake
 * (auth.token), khong phai tu header Authorization - xem Doc/Technical_Spec.md muc 6.
 */
const NON_API_PATH_PREFIXES = ['/ws/'];

/** Route cong khai, khop CHINH XAC (khong phai tien to) theo PUBLIC_GATEWAY_ROUTES. */
export function isPublicRoute(path: string): boolean {
  return PUBLIC_GATEWAY_ROUTES.includes(path);
}

function isNonApiPath(path: string): boolean {
  return NON_API_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** Trich token tu header "Authorization: Bearer <token>". */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

type RequestWithUser = Request & { user?: JwtAccessPayload };

/**
 * Middleware Express thuan (KHONG phai Nest guard/controller) xac thuc JWT truoc khi proxy
 * request toi cac downstream service - Technical_Spec.md muc 6.
 *
 * - Route cong khai (dang ky/dang nhap/refresh/health) hoac duong dan WebSocket: bo qua.
 * - Con lai: yeu cau "Authorization: Bearer <token>" hop le, verify bang JwtService voi
 *   JWT_ACCESS_SECRET. Neu thieu/khong hop le -> tra 401 ngay (KHONG proxy tiep).
 * - Neu hop le: gan req.user = payload de middleware proxy phia sau doc va gan header noi
 *   bo (x-org-id, x-user-id, x-user-email, x-roles, x-permissions).
 */
export function createJwtAuthMiddleware(
  jwtService: JwtService,
  configService: ConfigService,
): RequestHandler {
  const secret = configService.get<string>('jwt.accessSecret');

  return (req: Request, res: Response, next: NextFunction): void => {
    if (isNonApiPath(req.path) || isPublicRoute(req.path)) {
      next();
      return;
    }

    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      sendErrorResponse(
        res,
        401,
        'UnauthorizedException',
        'Thieu token xac thuc, vui long dang nhap lai',
        req.originalUrl,
      );
      return;
    }

    jwtService
      .verifyAsync<JwtAccessPayload>(token, { secret })
      .then((payload) => {
        (req as RequestWithUser).user = payload;
        next();
      })
      .catch(() => {
        sendErrorResponse(
          res,
          401,
          'UnauthorizedException',
          'Token khong hop le hoac da het han, vui long dang nhap lai',
          req.originalUrl,
        );
      });
  };
}
