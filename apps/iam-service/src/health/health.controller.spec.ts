import { IS_PUBLIC_KEY } from '@app/common-guard';
import { HealthCheckError, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import type { RedisService } from '../redis/redis.service';
import { HealthController } from './health.controller';

/**
 * 22/08/2026: unit test cho fix audit "GET /health chi la liveness-only (tra ve
 * {status:'ok'} cung cung bat ke DB con song hay khong), khien Docker bao container
 * 'healthy' du mat ket noi Postgres that su". Kiem tra HealthController.check():
 *  - van con @Public() (KHONG duoc yeu cau JWT - Docker/Gateway healthcheck goi khong
 *    kem token, xem infra/docker-compose.yml + guard InternalAuthGuard);
 *  - thuc su uy quyen cho HealthCheckService.check() voi indicator function goi
 *    TypeOrmHealthIndicator.pingCheck('database') (ping THAT ket noi TypeORM/Postgres,
 *    khac voi hardcode {status:'ok'} truoc do).
 * Dung mock thu cong (khong Test.createTestingModule) - cung quy uoc voi
 * apps/iam-service/src/roles/roles.controller.spec.ts va src/auth/auth.controller.spec.ts.
 *
 * 22/08/2026 (bo sung): them indicator Redis (checkRedis, xem redis-health.indicator.ts +
 * health.controller.ts) - test rieng ham checkRedis() nam o redis-health.indicator.spec.ts,
 * o day chi kiem tra HealthController.check() thuc su goi CA 2 indicator (database + redis).
 */
describe('HealthController (fix audit /health liveness-only, 22/08/2026)', () => {
  let controller: HealthController;
  let healthServiceMock: { check: jest.Mock };
  let dbMock: { pingCheck: jest.Mock };
  let redisServiceMock: RedisService;

  beforeEach(() => {
    dbMock = { pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) };
    redisServiceMock = { ping: jest.fn().mockResolvedValue('PONG') } as unknown as RedisService;
    healthServiceMock = {
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
    controller = new HealthController(
      healthServiceMock as unknown as HealthCheckService,
      dbMock as unknown as TypeOrmHealthIndicator,
      redisServiceMock,
    );
  });

  it('GET /health van la @Public() - khong duoc yeu cau JWT (Docker/Gateway goi khong kem token)', () => {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.check);
    expect(isPublic).toBe(true);
  });

  it('uy quyen cho HealthCheckService.check() voi indicator ping THAT ket noi TypeORM "database" VA Redis', async () => {
    const result = await controller.check();

    expect(healthServiceMock.check).toHaveBeenCalledTimes(1);
    const indicators = healthServiceMock.check.mock.calls[0][0] as Array<() => unknown>;
    expect(indicators).toHaveLength(2);

    expect(result).toEqual({
      status: 'ok',
      info: { database: { status: 'up' }, redis: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' }, redis: { status: 'up' } },
    });
    expect(dbMock.pingCheck).toHaveBeenCalledTimes(1);
    expect(dbMock.pingCheck).toHaveBeenCalledWith('database');
  });

  it('khi Postgres mat ket noi, loi tu pingCheck duoc lan truyen len (Terminus se tra ve HTTP 503, khong con hardcode 200 "ok")', async () => {
    const dbError = new Error('connect ECONNREFUSED - Postgres khong phan hoi');
    dbMock.pingCheck.mockRejectedValueOnce(dbError);
    healthServiceMock.check.mockImplementationOnce(async (indicators: Array<() => unknown>) => {
      await Promise.all(indicators.map((indicator) => indicator()));
    });

    await expect(controller.check()).rejects.toThrow(dbError);
  });

  it('khi Redis mat ket noi, loi tu checkRedis duoc lan truyen len (Terminus se tra ve HTTP 503)', async () => {
    (redisServiceMock.ping as jest.Mock).mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:6379'));
    healthServiceMock.check.mockImplementationOnce(async (indicators: Array<() => unknown>) => {
      await Promise.all(indicators.map((indicator) => indicator()));
    });

    await expect(controller.check()).rejects.toThrow(HealthCheckError);
  });
});
