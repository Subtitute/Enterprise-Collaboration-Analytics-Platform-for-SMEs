import { IS_PUBLIC_KEY } from '@app/common-guard';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';

/**
 * 22/08/2026: unit test cho fix audit "GET /health chi la liveness-only (tra ve
 * {status:'ok'} cung cung bat ke DB con song hay khong), khien Docker bao container
 * 'healthy' du mat ket noi Postgres that su". Kiem tra HealthController.check():
 *  - van con @Public() (KHONG duoc yeu cau JWT - Docker/Gateway healthcheck goi khong
 *    kem token, xem infra/docker-compose.yml + guard InternalAuthGuard);
 *  - thuc su uy quyen cho HealthCheckService.check() voi 1 indicator function goi
 *    TypeOrmHealthIndicator.pingCheck('database') (ping THAT ket noi TypeORM/Postgres,
 *    khac voi hardcode {status:'ok'} truoc do).
 * Dung mock thu cong (khong Test.createTestingModule) - cung quy uoc voi
 * apps/iam-service/src/roles/roles.controller.spec.ts va src/auth/auth.controller.spec.ts.
 */
describe('HealthController (fix audit /health liveness-only, 22/08/2026)', () => {
  let controller: HealthController;
  let healthServiceMock: { check: jest.Mock };
  let dbMock: { pingCheck: jest.Mock };

  beforeEach(() => {
    dbMock = { pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) };
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
    );
  });

  it('GET /health van la @Public() - khong duoc yeu cau JWT (Docker/Gateway goi khong kem token)', () => {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.check);
    expect(isPublic).toBe(true);
  });

  it('uy quyen cho HealthCheckService.check() voi indicator ping THAT ket noi TypeORM "database"', async () => {
    const result = await controller.check();

    expect(healthServiceMock.check).toHaveBeenCalledTimes(1);
    const indicators = healthServiceMock.check.mock.calls[0][0] as Array<() => unknown>;
    expect(indicators).toHaveLength(1);

    expect(result).toEqual({
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
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
});
