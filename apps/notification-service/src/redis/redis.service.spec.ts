import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

/**
 * 25/08/2026: unit test cho RedisService moi cua notification-service (fix ra soat bao mat - xem
 * apps/notification-service/src/realtime/notifications.gateway.ts). Gan truc tiep field private
 * `client` (thay vi goi onModuleInit() that) - mirror cach cac spec RedisService khac trong repo.
 */
function createService(clientMock: { get: jest.Mock }): RedisService {
  const configServiceMock = { get: jest.fn() } as unknown as ConfigService;
  const service = new RedisService(configServiceMock);
  (service as unknown as { client: unknown }).client = clientMock;
  return service;
}

describe('RedisService.isUserBlacklisted (Notification Service)', () => {
  afterEach(() => jest.useRealTimers());

  it('tra ve true khi khoa blacklist:user:<id> ton tai', async () => {
    const service = createService({ get: jest.fn().mockResolvedValue('1') });

    await expect(service.isUserBlacklisted('user-1')).resolves.toBe(true);
  });

  it('tra ve false khi khoa blacklist:user:<id> khong ton tai', async () => {
    const service = createService({ get: jest.fn().mockResolvedValue(null) });

    await expect(service.isUserBlacklisted('user-1')).resolves.toBe(false);
  });

  it('nem loi timeout sau 1000ms khi Redis "treo" (khong resolve/reject)', async () => {
    jest.useFakeTimers();
    const service = createService({ get: jest.fn(() => new Promise<never>(() => undefined)) });

    const pending = service.isUserBlacklisted('user-1');
    const assertion = expect(pending).rejects.toThrow('vuot qua');
    await jest.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  // 29/08/2026: bo sung 2 nhanh reject cua withTimeout() (nhanh resolve va nhanh timeout o tren
  // da co, thieu nhanh Redis tu no reject THAT SU truoc khi het 1000ms) - gop phan vao nguyen nhan
  // coverageThreshold "branches" (55%) cua notification-service khong dat (thuc te 49.57%).
  it('nem lai dung Error goc khi client.get() tu reject truoc khi het timeout', async () => {
    const redisError = new Error('Redis connection closed');
    const service = createService({ get: jest.fn().mockRejectedValue(redisError) });

    await expect(service.isUserBlacklisted('user-1')).rejects.toBe(redisError);
  });

  it('boc gia tri reject KHONG PHAI Error thanh 1 Error moi (vd client.get() reject 1 chuoi)', async () => {
    const service = createService({ get: jest.fn().mockRejectedValue('ECONNRESET') });

    await expect(service.isUserBlacklisted('user-1')).rejects.toThrow('ECONNRESET');
  });
});
