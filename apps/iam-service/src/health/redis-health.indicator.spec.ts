import { HealthCheckError } from '@nestjs/terminus';
import type { RedisService } from '../redis/redis.service';
import { checkRedis } from './redis-health.indicator';

/**
 * 22/08/2026: unit test cho checkRedis() moi bo sung (fix audit "/health cua iam-service chua
 * kiem tra Redis" - xem chu thich day du trong health.controller.ts). Sao chep tu
 * apps/gateway/src/health/redis-health.indicator.spec.ts (file mau tham chieu), chi doi
 * `getClient().ping()` (gateway) thanh `ping()` truc tiep (RedisService cua iam-service khong lo
 * client ioredis ra ngoai - xem redis/redis.service.ts).
 */
function createRedisService(ping: jest.Mock): RedisService {
  return { ping } as unknown as RedisService;
}

describe('checkRedis (iam-service)', () => {
  it('tra ve { redis: { status: "up" } } khi Redis tra loi PONG', async () => {
    const redisService = createRedisService(jest.fn().mockResolvedValue('PONG'));

    await expect(checkRedis(redisService, 'redis')).resolves.toEqual({
      redis: { status: 'up' },
    });
  });

  it('nem HealthCheckError khi PING tra ve gia tri khac PONG', async () => {
    const redisService = createRedisService(jest.fn().mockResolvedValue('WRONG'));

    await expect(checkRedis(redisService, 'redis')).rejects.toThrow(HealthCheckError);
  });

  it('nem HealthCheckError khi client Redis nem loi (vd mat ket noi)', async () => {
    const redisService = createRedisService(
      jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379')),
    );

    await expect(checkRedis(redisService, 'redis')).rejects.toThrow(HealthCheckError);
  });

  // 22/08/2026: cung 1 kich ban "treo" da xac minh o gateway - ioredis mac dinh
  // enableOfflineQueue:true nen .ping() KHONG tu that bai nhanh khi mat ket noi.
  it('nem HealthCheckError sau timeoutMs khi Redis "treo" (khong resolve/reject)', async () => {
    const redisService = createRedisService(jest.fn().mockReturnValue(new Promise<never>(() => undefined)));

    await expect(checkRedis(redisService, 'redis', 20)).rejects.toThrow(HealthCheckError);
  });
});
