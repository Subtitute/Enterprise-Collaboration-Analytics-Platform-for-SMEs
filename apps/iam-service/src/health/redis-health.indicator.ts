import { HealthCheckError, type HealthIndicatorResult } from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';

/**
 * 22/08/2026: sao chep tu apps/gateway/src/health/redis-health.indicator.ts (file mau tham
 * chieu) - fix audit "/health cua iam-service chua kiem tra Redis" du login()/deactivate() deu
 * phu thuoc Redis (throttle dang nhap, blacklist token/tai khoan). Boc Promise.race voi timeout
 * rieng vi `.ping()` KHONG tu that bai nhanh khi mat ket noi - ioredis mac dinh
 * `enableOfflineQueue: true` nen lenh bi XEP HANG CHO toi khi ket noi lai duoc (hoac toi khi het
 * maxRetriesPerRequest, mac dinh 20 lan retry voi backoff, co the mat toi hang chuc giay) thay vi
 * tra loi ngay - da kiem chung hanh vi nay khi lam Redis health check cho Gateway.
 */
const DEFAULT_TIMEOUT_MS = 2000;

export async function checkRedis(
  redisService: RedisService,
  key: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<HealthIndicatorResult> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const reply = await Promise.race([
      redisService.ping(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`PING Redis khong phan hoi sau ${timeoutMs}ms`)), timeoutMs);
        timer.unref();
      }),
    ]);
    if (reply !== 'PONG') {
      throw new Error(`PING Redis tra ve gia tri khong mong doi: ${reply}`);
    }
    return { [key]: { status: 'up' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new HealthCheckError('Redis check failed', {
      [key]: { status: 'down', message },
    });
  } finally {
    clearTimeout(timer);
  }
}
