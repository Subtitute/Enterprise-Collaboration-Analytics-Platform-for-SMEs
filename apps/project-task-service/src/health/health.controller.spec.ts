import { HealthController } from './health.controller';

/**
 * 22/08/2026: unit test cho fix audit "/health chi liveness-only" - khoa lai hanh vi
 * HealthController.check() phai goi TypeOrmHealthIndicator.pingCheck('database') thong qua
 * HealthCheckService.check() (khong con hardcode {status:'ok'} bat ke DB con song hay khong).
 * Mock thu cong HealthCheckService/TypeOrmHealthIndicator (tuong tu
 * apps/project-task-service/src/tasks/tasks.service.spec.ts), khong can Test.createTestingModule.
 */
describe('HealthController', () => {
  it('goi TypeOrmHealthIndicator.pingCheck("database") qua HealthCheckService.check va tra ve ket qua khi DB song', async () => {
    const pingResult = { database: { status: 'up' } };
    const dbIndicatorMock = { pingCheck: jest.fn().mockResolvedValue(pingResult) };
    const healthCheckServiceMock = {
      check: jest.fn(async (indicators: Array<() => Promise<Record<string, unknown>>>) => {
        const results = await Promise.all(indicators.map((indicator) => indicator()));
        const details = Object.assign({}, ...results);
        return { status: 'ok', info: details, error: {}, details };
      }),
    };

    const controller = new HealthController(healthCheckServiceMock as any, dbIndicatorMock as any);
    const result = await controller.check();

    expect(dbIndicatorMock.pingCheck).toHaveBeenCalledWith('database');
    expect(healthCheckServiceMock.check).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'ok', info: pingResult, error: {}, details: pingResult });
  });

  it('lan truyen loi tu HealthCheckService.check khi DB chet (TypeOrmHealthIndicator.pingCheck that bai) - Terminus se tra 503', async () => {
    const dbError = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    const dbIndicatorMock = { pingCheck: jest.fn().mockRejectedValue(dbError) };
    const healthCheckServiceMock = {
      check: jest.fn(async (indicators: Array<() => Promise<unknown>>) => {
        await Promise.all(indicators.map((indicator) => indicator()));
      }),
    };

    const controller = new HealthController(healthCheckServiceMock as any, dbIndicatorMock as any);

    await expect(controller.check()).rejects.toThrow('connect ECONNREFUSED');
    expect(dbIndicatorMock.pingCheck).toHaveBeenCalledWith('database');
  });
});
