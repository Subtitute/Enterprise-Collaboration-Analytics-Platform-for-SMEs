// 26/10/2026: dong bo read-model du an - backfill qua endpoint noi bo (co bi mat) TRUOC khi chay
// consumer, va xu ly message Kafka (JSON hong/loi du lieu vinh vien bo qua, loi tam thoi nem lai).
import { QueryFailedError } from 'typeorm';
import { EVENT_TYPES, INTERNAL_SHARED_SECRET_HEADER, KAFKA_TOPICS } from '@app/common-dto';
import { INITIAL_BACKFILL_ATTEMPTS, ProjectScopeSyncService } from './project-scope-sync.service';

function buildService() {
  const config: Record<string, string> = {
    'projectTask.url': 'http://project-task-service:3002',
    internalSecret: 'secret-1',
    'kafka.broker': 'kafka:29092',
  };
  const configService = { get: jest.fn((key: string) => config[key]) };
  const projectScopeService = {
    applyEvent: jest.fn().mockResolvedValue(true),
    replaceProjectSnapshot: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ProjectScopeSyncService(configService as never, projectScopeService as never);
  return { service, projectScopeService };
}

const SNAPSHOT = { takenAt: '2026-10-26T03:00:00.000Z', projects: [{ projectId: 'p1', organizationId: 'o', leadUserId: null, memberUserIds: [] }] };

describe('ProjectScopeSyncService', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('fetchSnapshot: goi endpoint noi bo kem x-internal-secret; HTTP loi hoac body sai -> nem loi', async () => {
    const { service } = buildService();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(SNAPSHOT) });
    global.fetch = fetchMock as never;
    await expect(service.fetchSnapshot()).resolves.toEqual(SNAPSHOT);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://project-task-service:3002/api/v1/internal/project-memberships',
      expect.objectContaining({ headers: { [INTERNAL_SHARED_SECRET_HEADER]: 'secret-1' } }),
    );

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as never;
    await expect(service.fetchSnapshot()).rejects.toThrow('HTTP 401');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }) as never;
    await expect(service.fetchSnapshot()).rejects.toThrow();
  });

  it('backfill: thu lai khi Project-Task Service chua san sang, thanh cong thi thay read-model; het luot -> false', async () => {
    jest.useFakeTimers();
    const { service, projectScopeService } = buildService();
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(SNAPSHOT) }) as never;

    const done = service.backfill(INITIAL_BACKFILL_ATTEMPTS);
    await jest.advanceTimersByTimeAsync(5_000);
    await expect(done).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(projectScopeService.replaceProjectSnapshot).toHaveBeenCalledWith(SNAPSHOT);

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as never;
    const failed = service.backfill(3);
    await jest.advanceTimersByTimeAsync(5_000 + 10_000);
    await expect(failed).resolves.toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  // 26/10/2026: backfill loi lau (vd sai bi mat) khong con chan consumer - consumer chay, backfill thu tiep o nen.
  it('run: backfill that bai het luot -> VAN chay consumer roi thu backfill o nen', async () => {
    const { service } = buildService();
    jest.spyOn(service, 'backfill').mockResolvedValue(false);
    const startConsumer = jest.spyOn(service, 'startConsumer').mockResolvedValue(undefined);
    const background = jest.spyOn(service, 'backfillInBackground').mockResolvedValue(undefined);
    await service.run();
    expect(startConsumer).toHaveBeenCalledTimes(1);
    expect(background).toHaveBeenCalledTimes(1);
  });

  it('backfillInBackground: tam dung topic project-task, doi message dang xu ly, chup + thay roi chay tiep', async () => {
    jest.useFakeTimers();
    const { service, projectScopeService } = buildService();
    const order: string[] = [];
    const consumer = { pause: jest.fn(() => order.push('pause')), resume: jest.fn(() => order.push('resume')) };
    let finishInFlight: () => void = () => undefined;
    Object.assign(service as object, {
      consumer,
      inFlight: new Promise<void>((resolve) => {
        finishInFlight = () => {
          order.push('in-flight done');
          resolve();
        };
      }),
    });
    projectScopeService.replaceProjectSnapshot.mockImplementation(async () => {
      order.push('replace');
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(SNAPSHOT) }) as never;

    const done = service.backfillInBackground();
    await jest.advanceTimersByTimeAsync(5_000 * INITIAL_BACKFILL_ATTEMPTS);
    expect(order).toEqual(['pause']);
    finishInFlight();
    await done;
    expect(order).toEqual(['pause', 'in-flight done', 'replace', 'resume']);
    expect(consumer.pause).toHaveBeenCalledWith([{ topic: KAFKA_TOPICS.PROJECT_TASK }]);
  });

  it('run: backfill xong moi chay consumer; dung service giua chung -> khong chay consumer', async () => {
    const { service } = buildService();
    const order: string[] = [];
    jest.spyOn(service, 'backfill').mockImplementation(async () => {
      order.push('backfill');
      return true;
    });
    const startConsumer = jest.spyOn(service, 'startConsumer').mockImplementation(async () => {
      order.push('consumer');
    });
    await service.run();
    expect(order).toEqual(['backfill', 'consumer']);

    await service.onModuleDestroy();
    startConsumer.mockClear();
    await service.run();
    expect(startConsumer).not.toHaveBeenCalled();
  });

  it('handleMessage: ap dung su kien hop le; bo qua JSON hong/envelope thieu/loi du lieu; nem lai loi tam thoi', async () => {
    const { service, projectScopeService } = buildService();
    const message = (value: unknown) => Buffer.from(JSON.stringify(value));
    const valid = { eventId: 'e', eventType: EVENT_TYPES.PROJECT_MEMBER_ADDED, organizationId: 'o', payload: { projectId: 'p', userId: 'u' } };

    await service.handleMessage(message(valid));
    expect(projectScopeService.applyEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: EVENT_TYPES.PROJECT_MEMBER_ADDED }));

    projectScopeService.applyEvent.mockClear();
    await service.handleMessage(null);
    await service.handleMessage(Buffer.from('{khong-phai-json'));
    await service.handleMessage(message({ eventType: 'x' }));
    expect(projectScopeService.applyEvent).not.toHaveBeenCalled();

    projectScopeService.applyEvent.mockRejectedValueOnce(new QueryFailedError('q', [], Object.assign(new Error('x'), { code: '22P02' })));
    await expect(service.handleMessage(message(valid))).resolves.toBeUndefined();

    projectScopeService.applyEvent.mockRejectedValueOnce(new Error('mat ket noi DB'));
    await expect(service.handleMessage(message(valid))).rejects.toThrow('mat ket noi DB');
  });
});
