import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ERROR_CODES, PUBLIC_GATEWAY_ROUTES, type JwtAccessPayload } from '@app/common-dto';
import { RedisService } from '../redis/redis.service';
import { sendErrorResponse } from '../common/send-error-response';

const logger = new Logger('JwtAuthMiddleware');

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
 * - Sau khi verify chu ky thanh cong, kiem tra them Redis xem tai khoan (claim `sub`) co dang
 *   bi blacklist hay khong (vd vua bi deactivate) - Technical_Spec.md muc 6 (bo sung 21/07/2026).
 *   Neu Redis loi tam thoi, fail-open (cho qua, chi log canh bao) giong triet ly cua rate-limit,
 *   de mot su co Redis khong lam sap toan bo Gateway.
 * - Neu hop le: gan req.user = payload de middleware proxy phia sau doc va gan header noi
 *   bo (x-org-id, x-user-id, x-user-email, x-roles, x-permissions).
 */
export function createJwtAuthMiddleware(
  jwtService: JwtService,
  configService: ConfigService,
  redisService: RedisService,
): RequestHandler {
  const secret = configService.get<string>('jwt.accessSecret');

  // 25/07/2026: chuyen tu promise chain (.then/.catch long nhau) sang async/await + try/catch -
  // phat hien qua code review toan du an: nhanh xu ly SAU KHI verify JWT thanh cong (kiem tra
  // blacklist Redis + goi next()) truoc day nam trong MOT promise chain long ben trong .then()
  // nhung KHONG duoc return ra ngoai, nen no bi "roi" (detached) khoi .catch() ngoai cung. Neu
  // sendErrorResponse() hoac next() (vd mot middleware/proxy phia sau nem loi dong bo) nem loi
  // bat ky luc nao trong nhanh do, loi se tro thanh "unhandled promise rejection" - mac dinh cua
  // Node.js (tu ban 15) la LAM SAP TOAN BO TIEN TRINH (moi nguoi dung dang ket noi) chi vi MOT
  // request loi. Voi async/await, MOI buoc bat dong bo deu duoc "await" ben trong try/catch bao
  // quanh no nen khong con doan promise nao co the "roi" ra ngoai duoc nua.
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        ERROR_CODES.GATEWAY_MISSING_TOKEN,
      );
      return;
    }

    let payload: JwtAccessPayload;
    try {
      payload = await jwtService.verifyAsync<JwtAccessPayload>(token, { secret });
    } catch {
      sendErrorResponse(
        res,
        401,
        'UnauthorizedException',
        'Token khong hop le hoac da het han, vui long dang nhap lai',
        req.originalUrl,
        ERROR_CODES.GATEWAY_INVALID_TOKEN,
      );
      return;
    }

    // 25/07/2026: try/catch rieng cho toan bo nhanh SAU KHI verify JWT thanh cong - day chinh la
    // pham vi truoc day bi "roi" khoi promise chain (xem giai thich o comment tren ham). Bat ca
    // loi tu Redis (da co fail-open rieng ben duoi) LAN loi dong bo bat ngo tu sendErrorResponse()
    // hoac next(), tranh lam sap tien trinh vi mot loi khong luong truoc duoc o day.
    try {
      let blacklisted: boolean;
      try {
        blacklisted = await redisService.isUserBlacklisted(payload.sub);
      } catch (err) {
        logger.warn(
          `Kiem tra blacklist that bai, cho qua yeu cau: ${err instanceof Error ? err.message : String(err)}`,
        );
        blacklisted = false;
      }

      if (blacklisted) {
        sendErrorResponse(
          res,
          401,
          'UnauthorizedException',
          'Tai khoan da bi vo hieu hoa, vui long dang nhap lai',
          req.originalUrl,
          ERROR_CODES.GATEWAY_ACCOUNT_DISABLED,
        );
        return;
      }
      (req as RequestWithUser).user = payload;
      next();
    } catch (err) {
      logger.error(
        `Loi khong mong doi sau khi xac thuc JWT thanh cong: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (!res.headersSent) {
        sendErrorResponse(
          res,
          500,
          'INTERNAL_SERVER_ERROR',
          'Da xay ra loi khong xac dinh, vui long thu lai sau',
          req.originalUrl,
          ERROR_CODES.INTERNAL_ERROR,
        );
      }
    }
  };
}
