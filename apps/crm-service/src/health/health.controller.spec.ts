import { HealthController } from './health.controller';

/**
 * Unit test cho HealthController - mock thu cong HealthCheckService/TypeOrmHealthIndicator
 * (khong boot NestJS module hay DB that), mirror apps/crm-service/src/customers/customers.service.spec.ts.
 * Muc tieu: dam bao check() uy quyen cho HealthCheckService.check() voi dung 1 indicator function
 * goi TypeOrmHealthIndicator.pingCheck('database'), va ket qua tra ve (healthy/unhealthy) di
 * nguyen tu HealthCheckService (Terminus tu quyet dinh HTTP 200 vs 503 dua tren ket qua nay).
 */
describe('HealthController', () => {
  it('goi HealthCheckService.check() voi indicator ping Postgres qua khoa "database"', async () => {
    const dbMock = { pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) };
    const healthy = {
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    };
    const healthMock = { check: jest.fn().mockImplementation(async (indicators: Array<() => unknown>) => {
      await Promise.all(indicators.map((indicator) => indicator()));
      return healthy;
    }) };
    const controller = new HealthController(healthMock as any, dbMock as any);

    const result = await controller.check();

    expect(healthMock.check).toHaveBeenCalledTimes(1);
    expect(dbMock.pingCheck).toHaveBeenCalledWith('database');
    expect(result).toEqual(healthy);
  });

  it('tra thang ket qua unhealthy tu HealthCheckService khi Postgres khong san sang (Terminus se anh xa sang HTTP 503)', async () => {
    const dbMock = { pingCheck: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) };
    const unhealthy = {
      status: 'error',
      info: {},
      error: { database: { status: 'down', message: 'connect ECONNREFUSED' } },
      details: { database: { status: 'down', message: 'connect ECONNREFUSED' } },
    };
    const healthMock = { check: jest.fn().mockResolvedValue(unhealthy) };
    const controller = new HealthController(healthMock as any, dbMock as any);

    const result = await controller.check();

    expect(result).toEqual(unhealthy);
  });
});
