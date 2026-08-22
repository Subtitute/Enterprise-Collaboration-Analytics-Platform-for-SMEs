// 22/08/2026: file moi - unit test cho HealthController sau khi thay the body hardcoded
// {status:'ok'} bang readiness check thuc su qua @nestjs/terminus (fix audit "/health chi la
// liveness"). Mirror phong cach mock thu cong (khong dung @nestjs/testing) da dung o
// folders.service.spec.ts/files.service.spec.ts trong service nay - tu tao doi tuong gia cho
// HealthCheckService/TypeOrmHealthIndicator/HealthIndicatorService/MinioService roi `new`
// HealthController truc tiep.
import { IS_PUBLIC_KEY } from '@app/common-guard';
import { HealthController } from './health.controller';

describe('HealthController.check', () => {
  function buildController(overrides: {
    pingCheckMock?: jest.Mock;
    checkConnectionMock?: jest.Mock;
  }) {
    const pingCheckMock = overrides.pingCheckMock ?? jest.fn().mockResolvedValue({ database: { status: 'up' } });
    const checkConnectionMock = overrides.checkConnectionMock ?? jest.fn().mockResolvedValue(undefined);

    const db = { pingCheck: pingCheckMock } as never;
    const minioService = { checkConnection: checkConnectionMock } as never;

    // Gia lap toi thieu HealthIndicatorService.check(key) - tra ve 1 "session" co up()/down(),
    // dung format {[key]: {status, ...data}} giong hanh vi thuc cua @nestjs/terminus.
    const upMock = jest.fn((data?: Record<string, unknown>) => ({ minio: { status: 'up', ...data } }));
    const downMock = jest.fn((data?: Record<string, unknown>) => ({ minio: { status: 'down', ...data } }));
    const healthIndicatorService = {
      check: jest.fn().mockReturnValue({ up: upMock, down: downMock }),
    } as never;

    // Gia lap HealthCheckService.check() bang cach chay thang cac ham indicator duoc truyen vao
    // va gom ket qua lai (mirror logic tong hop cua HealthCheckExecutor that, xem
    // node_modules/@nestjs/terminus/dist/health-check/health-check-executor.service.js) - du de
    // kiem tra dung cac indicator nao da duoc goi va ket qua tra ve co dang gi, ma khong keo theo
    // toan bo bootstrap cua TerminusModule.
    const health = {
      check: jest.fn(async (indicators: Array<() => Promise<Record<string, unknown>>>) => {
        const results = await Promise.all(indicators.map((fn) => fn()));
        return results.reduce((acc, cur) => Object.assign(acc, cur), {});
      }),
    } as never;

    const controller = new HealthController(health, db, healthIndicatorService, minioService);
    return { controller, pingCheckMock, checkConnectionMock, upMock, downMock };
  }

  it('giu @Public() tren check() - route /health KHONG duoc yeu cau xac thuc (Docker healthcheck + Gateway public-route allowlist phu thuoc dieu nay)', () => {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.check);
    expect(isPublic).toBe(true);
  });

  it('tra ve status up cho ca database va minio khi ca 2 dependency deu song', async () => {
    const { controller, pingCheckMock, checkConnectionMock } = buildController({});

    const result = await controller.check();

    expect(pingCheckMock).toHaveBeenCalledWith('database');
    expect(checkConnectionMock).toHaveBeenCalled();
    expect(result).toEqual({
      database: { status: 'up' },
      minio: { status: 'up' },
    });
  });

  it('tra ve minio down (khong throw ra ngoai) khi MinioService.checkConnection() that bai, van bao gom ket qua database', async () => {
    const checkConnectionMock = jest.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:9000'));
    const { controller, downMock } = buildController({ checkConnectionMock });

    const result = await controller.check();

    expect(downMock).toHaveBeenCalledWith({ message: 'ECONNREFUSED 127.0.0.1:9000' });
    expect(result).toEqual({
      database: { status: 'up' },
      minio: { status: 'down', message: 'ECONNREFUSED 127.0.0.1:9000' },
    });
  });

  it('khong nuot loi cua TypeOrmHealthIndicator.pingCheck() - de HealthCheckService tu xu ly (dung hanh vi terminus that: pingCheck tu throw HealthCheckError khi Postgres chet)', async () => {
    const pingCheckMock = jest.fn().mockRejectedValue(new Error('Postgres khong ket noi duoc'));
    const { controller } = buildController({ pingCheckMock });

    await expect(controller.check()).rejects.toThrow('Postgres khong ket noi duoc');
  });
});
