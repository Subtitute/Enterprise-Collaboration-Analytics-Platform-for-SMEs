import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ERROR_CODES, type JwtAccessPayload } from '@app/common-dto';
import { RedisService } from '../redis/redis.service';
import { sendErrorResponse } from '../common/send-error-response';
import { withTimeout } from '../common/with-timeout.util';
import {
  buildRateLimitKey,
  evaluateRateLimit,
  getClientIp,
  type RateLimitDecision,
  type RateLimitIdentity,
} from './rate-limit.util';

const logger = new Logger('RateLimitMiddleware');

type RequestWithUser = Request & { user?: JwtAccessPayload };

// 22/08/2026: phat hien qua kiem thu that (tat container Redis) khi lam sau health check moi cua
// Gateway (health.controller.ts) - ioredis mac dinh `enableOfflineQueue: true`, nghia la khi mat
// ket noi, `client.incr(...)` KHONG tu choi (reject) ngay ma xep hang cho ket noi lai vo thoi han.
// `.catch()` ben duoi vi vay khong bao gio chay, `next()` khong bao gio duoc goi -> TOAN BO
// Gateway "treo" vo thoi han voi MOI request trong luc Redis gap su co, di NGUOC LAI chinh thiet ke
// "fail-open" da ghi trong comment cuoi file (chi xu ly duoc truong hop tu choi ngay, khong xu ly
// duoc truong hop "khong bao gio tra loi"). Bao boc bang timeout de dam bao luon fail-open THAT SU.
//
// 22/08/2026 (bo sung): withTimeout() truoc day dinh nghia rieng NGAY TAI DAY - da chuyen sang
// ../common/with-timeout.util.ts de jwt-auth.middleware.ts (co CUNG 1 lop loi voi lenh Redis kiem
// tra JWT blacklist, phat hien qua rieng ra soat) dung chung, tranh lap lai dung sai lam da khien
// ban fix truoc chi ap dung o 1 noi duy nhat trong 2 noi Gateway goi Redis.
const RATE_LIMIT_TIMEOUT_MS = 1000;

/**
 * 25/08/2026: fix ra soat bao mat - tach logic kiem tra rate-limit (INCR/EXPIRE + danh gia
 * nguong) ra khoi middleware Express de jwt-auth.middleware.ts co the goi TRUC TIEP truoc khi tra
 * 401 (thieu/sai token). Phat hien qua ra soat: jwt-auth chay TRUOC rate-limit trong pipeline (xem
 * setup-gateway.ts), va middleware nay tra 401 NGAY (khong goi next()) khi thieu/sai token - nghia
 * la request thieu/sai token KHONG BAO GIO toi duoc rate-limit middleware o duoi, hoan toan khong
 * bi dem/chan boi bat ky gioi han nao. Ke tan cong co the flood 1 route bat ky voi token rong/gia
 * o toc do tuy y ma khong bao gio bi 429 - vo hieu hoa lop bao ve chinh cua Gateway cho da so
 * traffic doc hai thuc te (quet/flood), doc lap voi van de gia mao X-Real-IP.
 */
export async function checkRateLimit(
  redisService: RedisService,
  configService: ConfigService,
  ip: string,
  identity?: RateLimitIdentity,
): Promise<RateLimitDecision> {
  // 24/10/2026: 2 nguong rieng - theo NGUOI DUNG (da xac thuc) va theo IP (chua xac thuc), xem
  // buildRateLimitKey(). Nguong theo IP giu nguyen 100 nhu truoc de khong noi long chan brute-force.
  const max = identity
    ? (configService.get<number>('rateLimit.max') ?? 300)
    : (configService.get<number>('rateLimit.anonymousMax') ?? 100);
  const windowSeconds = configService.get<number>('rateLimit.windowSeconds') ?? 60;
  const client = redisService.getClient();
  const key = buildRateLimitKey(ip, identity);

  try {
    // 26/08/2026: fix loi MAJOR (ra soat bao mat) - truoc day INCR va EXPIRE (co dieu kien, chi khi
    // vua tao key) la 2 lenh Redis RIENG BIET; mat ket noi giua 2 lenh do de lai key khong co TTL,
    // khoa nguoi dung/to chuc do vao rate-limit VINH VIEN. Thay bang lenh incrWithExpire (Lua script
    // EVALSHA, dang ky trong RedisService.onModuleInit()) thuc hien ca 2 buoc NGUYEN TU trong 1 lenh
    // Redis duy nhat - xem chu thich chi tiet tai noi dang ky (redis.service.ts).
    const count = await withTimeout(
      client.incrWithExpire(key, windowSeconds),
      RATE_LIMIT_TIMEOUT_MS,
      `Redis rate-limit check vuot qua ${RATE_LIMIT_TIMEOUT_MS}ms`,
    );
    return evaluateRateLimit(count, max);
  } catch (err) {
    // Redis loi -> fail-open (cho qua) de Gateway khong sap toan bo he thong chi vi
    // rate limiter, chi ghi log canh bao. Day la lua chon co chu dich, khong phai bo sot.
    logger.warn(
      `Kiem tra rate-limit that bai, cho qua yeu cau: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { allowed: true, count: 0, remaining: max };
  }
}

/**
 * Rate limiting co ban theo IP (+ organizationId khi da biet) dung bo dem fixed-window
 * tren Redis (INCR + EXPIRE lan dau) - Technical_Spec.md muc 8.
 *
 * Dang ky SAU middleware xac thuc JWT (xem setup-gateway.ts, dieu chinh 21/07/2026) de
 * req.user (neu co) da duoc gan truoc khi khoa rate-limit duoc xay, cho phep phan
 * organizationId trong buildRateLimitKey thuc su kich hoat voi request da xac thuc.
 * Voi route cong khai (vd /api/v1/auth/login) - middleware xac thuc JWT bo qua hoan toan nen
 * KHONG gan req.user - rate-limit o day tu dong roi ve IP-only nhu thiet ke von co: van du
 * de chan brute-force dang nhap theo IP truoc khi nguoi dung co JWT hop le.
 *
 * Request thieu/sai token (khong toi duoc day - xem checkRateLimit() o tren) duoc
 * jwt-auth.middleware.ts tu kiem tra IP-only TRUOC khi tra 401.
 */
export function createRateLimitMiddleware(
  redisService: RedisService,
  configService: ConfigService,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const user = (req as RequestWithUser).user;
    const identity = user ? { organizationId: user.organizationId, userId: user.sub } : undefined;

    checkRateLimit(redisService, configService, ip, identity).then((decision) => {
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
      next();
    });
  };
}
