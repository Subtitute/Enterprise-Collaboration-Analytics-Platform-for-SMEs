import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ERROR_CODES, type JwtAccessPayload } from '@app/common-dto';
import { RedisService } from '../redis/redis.service';
import { sendErrorResponse } from '../common/send-error-response';
import { buildRateLimitKey, evaluateRateLimit, getClientIp } from './rate-limit.util';

const logger = new Logger('RateLimitMiddleware');

type RequestWithUser = Request & { user?: JwtAccessPayload };

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

    client
      .incr(key)
      .then(async (count) => {
        if (count === 1) {
          await client.expire(key, windowSeconds);
        }

        const decision = evaluateRateLimit(count, max);
        if (!decision.allowed) {
          sendErrorResponse(
            res,
            429,
            'TooManyRequestsException',
            'Ban da gui qua nhieu yeu cau, vui long thu lai sau it phut',
            req.originalUrl,
            ERROR_CODES.GATEWAY_RATE_LIMITED,
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
