import { ConfigService } from '@nestjs/config';
import { MinioService } from './minio.service';

/**
 * 22/08/2026: unit test cho withTimeout() moi bo sung trong checkConnection()/putObject() (fix
 * audit "SDK minio khong dat timeout tren bat ky HTTP call nao, nen 1 lan MinIO 'treo' mang - vd
 * container dong bang, ket noi nua-mo - khien ca 2 ham nay treo VO THOI HAN"). Gan truc tiep field
 * private `client`/`bucket` (thay vi goi onModuleInit() that, von tao Minio.Client that noi ra
 * mang) - mirror cach apps/gateway/src/health/redis-health.indicator.spec.ts kiem tra hanh vi
 * timeout bang 1 Promise khong bao gio resolve/reject + fake timer.
 */
function createService(clientMock: { bucketExists: jest.Mock; putObject: jest.Mock }): MinioService {
  const configServiceMock = { get: jest.fn() } as unknown as ConfigService;
  const service = new MinioService(configServiceMock);
  (service as unknown as { client: unknown }).client = clientMock;
  (service as unknown as { bucket: string }).bucket = 'test-bucket';
  return service;
}

describe('MinioService - timeout tren checkConnection()/putObject() (Document Service)', () => {
  afterEach(() => jest.useRealTimers());

  it('checkConnection() thanh cong khi bucketExists() tra ve true', async () => {
    const service = createService({ bucketExists: jest.fn().mockResolvedValue(true), putObject: jest.fn() });

    await expect(service.checkConnection()).resolves.toBeUndefined();
  });

  it('checkConnection() nem loi ro rang khi bucket khong ton tai', async () => {
    const service = createService({ bucketExists: jest.fn().mockResolvedValue(false), putObject: jest.fn() });

    await expect(service.checkConnection()).rejects.toThrow('khong ton tai');
  });

  it('checkConnection() nem loi timeout sau 2000ms khi MinIO "treo" (khong resolve/reject)', async () => {
    jest.useFakeTimers();
    const service = createService({
      bucketExists: jest.fn(() => new Promise<never>(() => undefined)),
      putObject: jest.fn(),
    });

    const pending = service.checkConnection();
    const assertion = expect(pending).rejects.toThrow('vuot qua');
    await jest.advanceTimersByTimeAsync(2000);
    await assertion;
  });

  it('putObject() thanh cong khi client.putObject() resolve binh thuong', async () => {
    const service = createService({ bucketExists: jest.fn(), putObject: jest.fn().mockResolvedValue(undefined) });

    await expect(service.putObject('key.txt', Buffer.from('data'), 4, 'text/plain')).resolves.toBeUndefined();
  });

  it('putObject() nem loi timeout sau 30s khi MinIO "treo" (khong resolve/reject) - khong treo request vo han', async () => {
    jest.useFakeTimers();
    const service = createService({
      bucketExists: jest.fn(),
      putObject: jest.fn(() => new Promise<never>(() => undefined)),
    });

    const pending = service.putObject('key.txt', Buffer.from('data'), 4, 'text/plain');
    const assertion = expect(pending).rejects.toThrow('vuot qua');
    await jest.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  // 22/08/2026: khac voi test "treo" o tren (timer thang), day la nhanh client.putObject() TU CHOI
  // NGAY (loi that, khong phai timeout) - phu 1 nhanh khac cua withTimeout() (promise.then nhanh
  // reject) chua duoc test o tren.
  it('putObject() nem lai NGUYEN VAN loi that khi client.putObject() bi tu choi ngay (khong phai timeout)', async () => {
    const service = createService({
      bucketExists: jest.fn(),
      putObject: jest.fn().mockRejectedValue(new Error('MinIO tu choi: het dung luong')),
    });

    await expect(service.putObject('key.txt', Buffer.from('data'), 4, 'text/plain')).rejects.toThrow(
      'MinIO tu choi: het dung luong',
    );
  });
});
