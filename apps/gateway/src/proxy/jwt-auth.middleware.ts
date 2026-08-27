import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ERROR_CODES, PUBLIC_GATEWAY_ROUTES, type JwtAccessPayload } from '@app/common-dto';
import { RedisService } from '../redis/redis.service';
import { sendErrorResponse } from '../common/send-error-response';
import { withTimeout } from '../common/with-timeout.util';
import { checkRateLimit } from '../rate-limit/rate-limit.middleware';
import { getClientIp } from '../rate-limit/rate-limit.util';

const logger = new Logger('JwtAuthMiddleware');

// 22/08/2026: phat hien qua rieng ra soat - redisService.isUserBlacklisted() ben duoi da co
// try/catch (khong lam crash) nhung KHONG co timeout, khac voi rate-limit.middleware.ts (da sua
// cung loi nay 22/08/2026). ioredis mac dinh `enableOfflineQueue: true` nen mat ket noi Redis
// khien lenh nay "treo" toi hang chuc giay thay vi tu choi ngay - MOI request da xac thuc qua
// Gateway (gan nhu toan bo traffic nghiep vu) se bi "treo" cho toi luc do, du try/catch cuoi cung
// van fail-open dung. Boc timeout de dam bao fail-open THAT SU trong thoi gian gioi han.
const BLACKLIST_CHECK_TIMEOUT_MS = 1000;

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

    // 25/08/2026: fix ra soat bao mat - jwt-auth chay TRUOC rate-limit trong pipeline (xem
    // setup-gateway.ts) va tra 401 NGAY (khong goi next()) khi thieu/sai token, nen truoc ban sua
    // nay request loai nay KHONG BAO GIO toi duoc rate-limit middleware ben duoi - hoan toan khong
    // bi dem/chan boi gioi han nao, cho phep flood toc do bat ky. Tu kiem tra rate-limit IP-only
    // (chua co req.user luc nay) TRUOC khi tra loi cho MOI nhanh early-return duoi day; vuot nguong
    // thi tra 429 thay vi status goc (dung nhu rate-limit middleware se lam neu request toi duoc).
    const ip = getClientIp(req);

    // 26/08/2026: refactor cau truc - sau 3 lan RIENG LE (25/08/2026 x2 cho nhanh "thieu token" va
    // "token khong hop le", 26/08/2026 cho nhanh "tai khoan blacklist") phat hien CUNG MOT loi (mot
    // nhanh early-return moi "quen" goi checkRateLimit() truoc khi tra loi) o 3 nhanh khac nhau
    // trong chinh file nay, toi ket luan van de khong nam o tung nhanh rieng le ma o CAU TRUC: khi
    // moi nhanh phai TU NHO "opt-in" vao rate-limit (goi dung ham sendUnauthorized() thay vi
    // sendErrorResponse() truc tiep), thi luon co the co nhanh moi (hoac nhanh cu bi sua lai) "quen"
    // lam dieu do - dung nhu da xay ra 3 lan lien tiep. Gop TOAN BO nhanh early-return trong ham nay
    // (ke ca nhanh loi noi bo 500 o cuoi, truoc day goi thang sendErrorResponse() ma khong qua
    // rate-limit - xem comment o do) thanh DUY NHAT MOT diem thoat - sendGatedResponse() ben duoi -
    // luon chay checkRateLimit() TRUOC TIEN roi moi gui status/message do noi goi chi dinh. Tu gio
    // ve sau, muon tra ve bat ky response nao ma khong goi next() deu BAT BUOC phai qua ham nay vi
    // day la duong DUY NHAT con lai de gui response trong pham vi middleware - khong con cach nao
    // "quen" rate-limit duoc nua, loai bo han lop bug nay bang cau truc thay vi phai nho quy uoc.
    async function sendGatedResponse(
      status: number,
      error: string,
      message: string,
      errorCode: string,
    ): Promise<void> {
      if (res.headersSent) return;
      const decision = await checkRateLimit(redisService, configService, ip);
      if (!decision.allowed) {
        sendErrorResponse(
          res,
          429,
          'TooManyRequestsException',
          'Ban da gui qua nhieu yeu cau, vui long thu lai sau it phut',
          req.originalUrl,
          ERROR_CODES.GATEWAY_RATE_LIMITED,
          req,
        );
        return;
      }
      sendErrorResponse(res, status, error, message, req.originalUrl, errorCode, req);
    }

    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      await sendGatedResponse(
        401,
        'UnauthorizedException',
        'Thieu token xac thuc, vui long dang nhap lai',
        ERROR_CODES.GATEWAY_MISSING_TOKEN,
      );
      return;
    }

    let payload: JwtAccessPayload;
    try {
      payload = await jwtService.verifyAsync<JwtAccessPayload>(token, { secret });
    } catch {
      await sendGatedResponse(
        401,
        'UnauthorizedException',
        'Token khong hop le hoac da het han, vui long dang nhap lai',
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
        blacklisted = await withTimeout(
          redisService.isUserBlacklisted(payload.sub),
          BLACKLIST_CHECK_TIMEOUT_MS,
          `Kiem tra blacklist Redis vuot qua ${BLACKLIST_CHECK_TIMEOUT_MS}ms`,
        );
      } catch (err) {
        logger.warn(
          `Kiem tra blacklist that bai, cho qua yeu cau: ${err instanceof Error ? err.message : String(err)}`,
        );
        blacklisted = false;
      }

      if (blacklisted) {
        // 26/08/2026: nhanh nay tung la nhanh 401 THU BA bi phat hien tra loi THANG qua
        // sendErrorResponse() ma khong qua rate-limit (xem lich su day du o comment cua
        // sendGatedResponse() phia tren) - gio dung chung sendGatedResponse() nhu moi nhanh khac
        // trong file, khong con la truong hop dac biet phai tu nho opt-in nua.
        await sendGatedResponse(
          401,
          'UnauthorizedException',
          'Tai khoan da bi vo hieu hoa, vui long dang nhap lai',
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
      // 26/08/2026: nhanh loi noi bo (500) nay TRUOC BAN REFACTOR nay goi thang sendErrorResponse(),
      // la nhanh early-return DUY NHAT trong file khong qua rate-limit - gio cung di qua
      // sendGatedResponse() (tu kiem tra res.headersSent ben trong) nhu moi nhanh khac, dam bao
      // KHONG CON nhanh nao trong file nay co the gui response ma bo qua rate-limit.
      await sendGatedResponse(
        500,
        'INTERNAL_SERVER_ERROR',
        'Da xay ra loi khong xac dinh, vui long thu lai sau',
        ERROR_CODES.INTERNAL_ERROR,
      );
    }
  };
}
