import { HealthController } from './health.controller';

/**
 * Unit test cho HealthController - fix audit "/health chi la liveness-only, luon tra ve
 * {status:'ok'} bat ke DB con song hay khong" (xem chu thich trong health.controller.ts).
 * Mock thu cong HealthCheckService/TypeOrmHealthIndicator (khong boot NestJS module hay DB
 * that), tuong tu apps/hrm-service/src/attendance/attendance.service.spec.ts.
 *
 * Muc tieu: dam bao check() thuc su goi TypeOrmHealthIndicator.pingCheck('database') va
 * truyen thang ket qua/loi tu HealthCheckService thay vi tu tra hardcode {status:'ok'}.
 */
describe('HealthController', () => {
  function createController(checkImpl?: jest.Mock) {
    const pingCheckMock = jest.fn().mockResolvedValue({ database: { status: 'up' } });
    const dbMock = { pingCheck: pingCheckMock };

    const checkMock =
      checkImpl ??
      jest.fn().mockImplementation(async (indicators: Array<() => Promise<Record<string, unknown>>>) => {
        const results = await Promise.all(indicators.map((indicator) => indicator()));
        const details = Object.assign({}, ...results);
        return { status: 'ok', info: details, error: {}, details };
      });
    const healthServiceMock = { check: checkMock };

    const controller = new HealthController(healthServiceMock as any, dbMock as any);
    return { controller, checkMock, pingCheckMock };
  }

  it('goi TypeOrmHealthIndicator.pingCheck("database") that su thay vi tra hardcode {status:"ok"}', async () => {
    const { controller, pingCheckMock } = createController();

    await controller.check();

    expect(pingCheckMock).toHaveBeenCalledWith('database');
  });

  it('tra ve ket qua healthy (status ok, details co database) khi DB ping thanh cong', async () => {
    const { controller } = createController();

    const result = await controller.check();

    expect(result).toMatchObject({ status: 'ok', details: { database: { status: 'up' } } });
  });

  it('nem lai loi (khong nuot loi) khi HealthCheckService bao DB khong healthy - de Terminus tra ve HTTP 503', async () => {
    const failure = new Error('Service Unavailable');
    const { controller } = createController(jest.fn().mockRejectedValue(failure));

    await expect(controller.check()).rejects.toThrow('Service Unavailable');
  });
});
