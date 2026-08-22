import { HealthCheckService, HealthIndicatorResult, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController, REDIS_PING_TIMEOUT_MS } from './health.controller';
import { RedisService } from '../redis/redis.service';

/**
 * 22/08/2026: unit test MOI cho HealthController sau khi doi tu {status:'ok'} co dinh
 * (audit: "/health liveness-only") sang @nestjs/terminus - MAU THAM CHIEU: fact-writer.service.spec.ts
 * / ai-insights.service.spec.ts (mock thu cong tung dependency, khoi tao controller truc tiep bang
 * `new`, khong dung @nestjs/testing TestingModule).
 *
 * Khong goi TimescaleDB/Redis that: HealthCheckService.check() va TypeOrmHealthIndicator.pingCheck()
 * duoc mock hoan toan; muc dich cua test nay la xac minh HealthController.check() truyen dung MANG
 * 2 ham indicator (database qua TypeOrmHealthIndicator, redis qua RedisService.ping() tu viet) vao
 * HealthCheckService.check(), va indicator redis tu quy doi ket qua PING/loi thanh dung shape
 * HealthIndicatorResult ({redis: {status: 'up'|'down', ...}}).
 */
describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckServiceMock: { check: jest.Mock };
  let typeOrmIndicatorMock: { pingCheck: jest.Mock };
  let redisServiceMock: { ping: jest.Mock };

  beforeEach(() => {
    healthCheckServiceMock = {
      check: jest.fn().mockResolvedValue({ status: 'ok', info: {}, error: {}, details: {} }),
    };
    typeOrmIndicatorMock = { pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) };
    redisServiceMock = { ping: jest.fn().mockResolvedValue('PONG') };

    controller = new HealthController(
      healthCheckServiceMock as unknown as HealthCheckService,
      typeOrmIndicatorMock as unknown as TypeOrmHealthIndicator,
      redisServiceMock as unknown as RedisService,
    );
  });

  it('goi HealthCheckService.check() voi dung 2 indicator (database + redis)', async () => {
    await controller.check();

    expect(healthCheckServiceMock.check).toHaveBeenCalledTimes(1);
    const indicators = healthCheckServiceMock.check.mock.calls[0][0];
    expect(indicators).toHaveLength(2);
  });

  it('indicator dau tien goi TypeOrmHealthIndicator.pingCheck("database") - kiem tra ket noi TimescaleDB that qua TypeORM', async () => {
    await controller.check();
    const [databaseIndicator] = healthCheckServiceMock.check.mock.calls[0][0] as Array<() => Promise<unknown>>;

    const result = await databaseIndicator();

    expect(typeOrmIndicatorMock.pingCheck).toHaveBeenCalledWith('database');
    expect(result).toEqual({ database: { status: 'up' } });
  });

  describe('indicator redis (tu viet, goi RedisService.ping())', () => {
    it('tra ve {redis: {status: "up"}} khi RedisService.ping() thanh cong', async () => {
      await controller.check();
      const [, redisIndicator] = healthCheckServiceMock.check.mock.calls[0][0] as Array<
        () => Promise<HealthIndicatorResult>
      >;

      const result = await redisIndicator();

      expect(redisServiceMock.ping).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ redis: { status: 'up' } });
    });

    it('tra ve {redis: {status: "down", message}} khi RedisService.ping() throw loi - KHONG duoc de loi thoat ra ngoai (se lam Terminus throw 500 thay vi 503 co kiem soat)', async () => {
      redisServiceMock.ping.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
      await controller.check();
      const [, redisIndicator] = healthCheckServiceMock.check.mock.calls[0][0] as Array<
        () => Promise<HealthIndicatorResult>
      >;

      const result = await redisIndicator();

      expect(result).toEqual({ redis: { status: 'down', message: 'connect ECONNREFUSED' } });
    });

    // 22/08/2026: xac minh bang tay qua docker (stop container redis roi goi /health that) phat hien
    // RedisService.ping() TREO VO HAN khi Redis mat ket noi (ioredis mac dinh xep lenh vao offline
    // queue cho ket noi lai thay vi reject ngay) - neu khong co timeout rieng, request /health se
    // treo thay vi tra 503 nhanh. Dung fake timer de mo phong PING "treo" (Promise khong bao gio
    // resolve/reject) va kiem tra checkRedis() van tra ve status down sau REDIS_PING_TIMEOUT_MS,
    // khong doi PING that.
    it('tra ve {redis: {status: "down"}} sau REDIS_PING_TIMEOUT_MS khi RedisService.ping() treo (khong resolve/reject) - khong duoc de /health treo vo han', async () => {
      jest.useFakeTimers();
      try {
        redisServiceMock.ping.mockReturnValue(new Promise(() => {}));
        await controller.check();
        const [, redisIndicator] = healthCheckServiceMock.check.mock.calls[0][0] as Array<
          () => Promise<HealthIndicatorResult>
        >;

        const resultPromise = redisIndicator();
        await jest.advanceTimersByTimeAsync(REDIS_PING_TIMEOUT_MS + 1);
        const result = await resultPromise;

        expect(result.redis.status).toBe('down');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  it('tra ve nguyen ket qua cua HealthCheckService.check() (khi mot indicator down, Terminus tu throw ServiceUnavailableException 503 - xem @nestjs/terminus)', async () => {
    const result = await controller.check();

    expect(result).toEqual({ status: 'ok', info: {}, error: {}, details: {} });
  });
});
