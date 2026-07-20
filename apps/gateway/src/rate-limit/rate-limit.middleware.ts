import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { JwtAccessPayload } from '@app/common-dto';
import { RedisService } from '../redis/redis.service';
import { sendErrorResponse } from '../common/send-error-response';
import { buildRateLimitKey, evaluateRateLimit, getClientIp } from './rate-limit.util';

const logger = new Logger('RateLimitMiddleware');

type RequestWithUser = Request & { user?: JwtAccessPayload };

/**
 * Rate limiting co ban theo IP (+ organizationId khi da biet) dung bo dem fixed-window
 * tren Redis (INCR + EXPIRE lan dau) - Technical_Spec.md muc 8.
 *
 * Dang ky la middleware Express SOM NHAT (truoc buoc xac thuc JWT) de cung chan duoc
 * brute-force vao /api/v1/auth/login khi con chua co JWT - Technical_Spec.md muc 9.
 * Vi vay tai thoi diem nay req.user hau nhu chua duoc gan (middleware xac thuc chay sau),
 * nen phan organizationId trong khoa chi phat huy khi co thu tu goi khac trong tuong lai;
 * ham buildRateLimitKey van nhan tham so nay de san sang mo rong.
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
