import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

/**
 * Mirror apps/notification-service/src/redis/redis.service.spec.ts - gan truc tiep field private
 * `client` (thay vi goi onModuleInit() that) de test isUserBlacklisted() khong can Redis that.
 */
function createService(clientMock: { get: jest.Mock }): RedisService {
  const configServiceMock = { get: jest.fn() } as unknown as ConfigService;
  const service = new RedisService(configServiceMock);
  (service as unknown as { client: unknown }).client = clientMock;
  return service;
}

describe('RedisService.isUserBlacklisted (Messaging Service)', () => {
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
});
