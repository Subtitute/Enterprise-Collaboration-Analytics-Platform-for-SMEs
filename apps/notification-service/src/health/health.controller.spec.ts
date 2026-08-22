import { ServiceUnavailableException } from '@nestjs/common';
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';

/**
 * 22/08/2026: unit test cho fix audit "/health liveness-only" - xac nhan HealthController
 * goi that HealthCheckService.check([...]) voi MongooseHealthIndicator.pingCheck('mongodb')
 * (khong con tra hardcoded { status: 'ok' }), va truong hop MongoDB down thi loi
 * ServiceUnavailableException tu Terminus (-> HTTP 503, xem TerminusModule.check trong
 * @nestjs/terminus) duoc truyen nguyen ven ra ngoai thay vi bi nuot.
 */
describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckServiceMock: { check: jest.Mock };
  let mongooseHealthIndicatorMock: { pingCheck: jest.Mock };

  beforeEach(() => {
    healthCheckServiceMock = { check: jest.fn() };
    mongooseHealthIndicatorMock = { pingCheck: jest.fn() };

    controller = new HealthController(
      healthCheckServiceMock as unknown as HealthCheckService,
      mongooseHealthIndicatorMock as unknown as MongooseHealthIndicator,
    );
  });

  it('goi HealthCheckService.check voi indicator MongooseHealthIndicator.pingCheck("mongodb")', async () => {
    const okResult = {
      status: 'ok',
      info: { mongodb: { status: 'up' } },
      error: {},
      details: { mongodb: { status: 'up' } },
    };
    mongooseHealthIndicatorMock.pingCheck.mockResolvedValue({ mongodb: { status: 'up' } });
    healthCheckServiceMock.check.mockImplementation(async (indicators: Array<() => unknown>) => {
      // Thuc thi indicator nhu HealthCheckExecutor that su lam, de dam bao pingCheck('mongodb')
      // duoc goi dung thay vi chi kiem tra tham chieu ham.
      await Promise.all(indicators.map((fn) => fn()));
      return okResult;
    });

    const result = await controller.check();

    expect(mongooseHealthIndicatorMock.pingCheck).toHaveBeenCalledWith('mongodb');
    expect(healthCheckServiceMock.check).toHaveBeenCalledTimes(1);
    expect(result).toEqual(okResult);
  });

  it('nem ServiceUnavailableException (503) khi MongoDB down thay vi tra { status: ok } gia', async () => {
    const downResult = {
      status: 'error',
      info: {},
      error: { mongodb: { status: 'down', message: 'connect ECONNREFUSED' } },
      details: { mongodb: { status: 'down', message: 'connect ECONNREFUSED' } },
    };
    healthCheckServiceMock.check.mockRejectedValue(new ServiceUnavailableException(downResult));

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(controller.check()).rejects.toMatchObject({ response: downResult });
  });
});
