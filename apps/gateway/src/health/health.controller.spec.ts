import { HealthCheckError } from '@nestjs/terminus';
import type { HealthCheckService } from '@nestjs/terminus';
import { IS_PUBLIC_KEY } from '@app/common-guard';
import type { RedisService } from '../redis/redis.service';
import { checkRedis } from './redis-health.indicator';
import { HealthController } from './health.controller';

/**
 * 22/08/2026: unit test cho fix audit "GET /health chi la liveness-only (tra ve
 * {status:'ok'} cung cung bat ke Redis con song hay khong), khien Docker bao container
 * 'healthy' du mat ket noi Redis that su (nen ca rate-limit lan kiem tra JWT blacklist deu
 * ngung hoat dong dung)". Gateway khong co DB rieng nen khong co TypeOrmHealthIndicator/
 * MongooseHealthIndicator co san nhu cac service khac - kiem tra ca ham checkRedis() thuan
 * (tuong tu rate-limit.util.spec.ts) LAN su uy quyen cua HealthController cho
 * HealthCheckService.check() (tuong tu apps/iam-service/src/health/health.controller.spec.ts).
 * Dung mock thu cong (khong Test.createTestingModule) - cung quy uoc voi
 * apps/gateway/src/proxy/jwt-auth.middleware.spec.ts.
 */
function createRedisService(ping: jest.Mock): RedisService {
  return { getClient: () => ({ ping }) } as unknown as RedisService;
}

describe('checkRedis', () => {
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

  it('HealthCheckError.causes chua status "down" va message loi goc, dung key duoc truyen vao', async () => {
    const redisService = createRedisService(
      jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379')),
    );

    await expect(checkRedis(redisService, 'redis')).rejects.toMatchObject({
      causes: { redis: { status: 'down', message: 'connect ECONNREFUSED 127.0.0.1:6379' } },
    });
  });

  // 22/08/2026: phat hien qua kiem tra thuc te (docker compose) - ioredis mac dinh
  // enableOfflineQueue:true nen .ping() KHONG tu that bai nhanh khi mat ket noi, ma XEP HANG CHO
  // toi khi ket noi lai duoc, co the "treo" hang chuc giay thay vi tra loi ngay. Mo phong bang mot
  // ping() KHONG BAO GIO resolve/reject, dam bao checkRedis() van tra ve HealthCheckError trong
  // gioi han timeoutMs thay vi treo vo han.
  it('nem HealthCheckError sau timeoutMs khi Redis "treo" (khong resolve/reject) - vd ket noi mat nhung lenh con bi ioredis xep hang cho', async () => {
    const redisService = createRedisService(jest.fn().mockReturnValue(new Promise(() => undefined)));

    await expect(checkRedis(redisService, 'redis', 20)).rejects.toThrow(HealthCheckError);
  });
});

describe('HealthController', () => {
  it('van la @Public() - khong yeu cau JWT (Docker healthcheck goi khong kem token, xem infra/docker-compose.yml)', () => {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.check);
    expect(isPublic).toBe(true);
  });

  it('uy quyen cho HealthCheckService.check() voi indicator PING Redis va tra ve ket qua khi Redis song', async () => {
    const redisService = createRedisService(jest.fn().mockResolvedValue('PONG'));
    const healthServiceMock = {
      check: jest.fn().mockImplementation(async (indicators: Array<() => unknown>) => {
        const results = await Promise.all(indicators.map((indicator) => indicator()));
        return {
          status: 'ok',
          info: Object.assign({}, ...results),
          error: {},
          details: Object.assign({}, ...results),
        };
      }),
    };
    const controller = new HealthController(
      healthServiceMock as unknown as HealthCheckService,
      redisService,
    );

    const result = await controller.check();

    expect(healthServiceMock.check).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'ok',
      info: { redis: { status: 'up' } },
      error: {},
      details: { redis: { status: 'up' } },
    });
  });

  it('khi Redis mat ket noi, loi tu checkRedis duoc lan truyen len (Terminus se tra ve HTTP 503, khong con hardcode 200 "ok")', async () => {
    const redisService = createRedisService(
      jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379')),
    );
    const healthServiceMock = {
      check: jest.fn().mockImplementation(async (indicators: Array<() => unknown>) => {
        await Promise.all(indicators.map((indicator) => indicator()));
      }),
    };
    const controller = new HealthController(
      healthServiceMock as unknown as HealthCheckService,
      redisService,
    );

    await expect(controller.check()).rejects.toThrow(HealthCheckError);
  });
});
