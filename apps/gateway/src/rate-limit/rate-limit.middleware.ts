import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ERROR_CODES, type JwtAccessPayload } from '@app/common-dto';
import { RedisService } from '../redis/redis.service';
import { sendErrorResponse } from '../common/send-error-response';
import { withTimeout } from '../common/with-timeout.util';
import { buildRateLimitKey, evaluateRateLimit, getClientIp } from './rate-limit.util';

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
 * Rate limiting co ban theo IP (+ organizationId khi da biet) dung bo dem fixed-window
 * tren Redis (INCR + EXPIRE lan dau) - Technical_Spec.md muc 8.
 *
 * Dang ky SAU middleware xac thuc JWT (xem setup-gateway.ts, dieu chinh 21/07/2026) de
 * req.user (neu co) da duoc gan truoc khi khoa rate-limit duoc xay, cho phep phan
 * organizationId trong buildRateLimitKey thuc su kich hoat voi request da xac thuc.
 * Voi route cong khai (vd /api/v1/auth/login) - middleware xac thuc JWT bo qua hoan toan nen
 * KHONG gan req.user - rate-limit o day tu dong roi ve IP-only nhu thiet ke von co: van du
 * de chan brute-force dang nhap theo IP truoc khi nguoi dung co JWT hop le.
 */
export function createRateLimitMiddleware(
  redisService: RedisService,
  configService: ConfigService,
): RequestHandler {
  const max = configService.get<number>('rateLimit.max') ?? 100;
  const windowSeconds = configService.get<number>('rateLimit.windowSeconds') ?? 60;

  return (req: Request, res: Response, next: NextFunction): void => {
    const client = redisService.getClient();
    const ip = getClientIp(req);
    const organizationId = (req as RequestWithUser).user?.organizationId;
    const key = buildRateLimitKey(ip, organizationId);

    withTimeout(
      client.incr(key).then(async (count) => {
        if (count === 1) {
          await client.expire(key, windowSeconds);
        }
        return count;
      }),
      RATE_LIMIT_TIMEOUT_MS,
      `Redis rate-limit check vuot qua ${RATE_LIMIT_TIMEOUT_MS}ms`,
    )
      .then((count) => {
        const decision = evaluateRateLimit(count, max);
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
      })
      .catch((err: unknown) => {
        // Redis loi -> fail-open (cho qua) de Gateway khong sap toan bo he thong chi vi
        // rate limiter, chi ghi log canh bao. Day la lua chon co chu dich, khong phai bo sot.
        logger.warn(
          `Kiem tra rate-limit that bai, cho qua yeu cau: ${err instanceof Error ? err.message : String(err)}`,
        );
        next();
      });
  };
}
