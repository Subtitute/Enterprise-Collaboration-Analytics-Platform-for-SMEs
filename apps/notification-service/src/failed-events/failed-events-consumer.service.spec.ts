import { ConfigService } from '@nestjs/config';
import { EachMessagePayload } from 'kafkajs';
import { DeadLetterEnvelope } from '@app/common-dto';
import { FailedEventsConsumerService } from './failed-events-consumer.service';
import { FailedEventsService } from './failed-events.service';

/**
 * 28/07/2026: unit test cho FailedEventsConsumerService (Technical_Spec.md muc 14 - nang cap
 * Dead Letter Queue) - consumer RIENG chi doc KAFKA_TOPICS.DLQ. Tap trung 2 kich ban:
 *  1. Message hop le (JSON.parse thanh cong 1 DeadLetterEnvelope) -> goi FailedEventsService.record.
 *  2. Message KHONG PHAI JSON hop le tren CHINH topic DLQ (kich ban hiem, mang tinh phong thu) ->
 *     log + bo qua, KHONG throw, KHONG goi record - dung mau voi KafkaConsumerService chinh
 *     (../kafka/kafka-consumer.service.ts) o nhanh MALFORMED_JSON.
 */
describe('FailedEventsConsumerService', () => {
  let service: FailedEventsConsumerService;
  let failedEventsServiceMock: { record: jest.Mock };

  beforeEach(() => {
    failedEventsServiceMock = { record: jest.fn().mockResolvedValue(undefined) };
    const configServiceMock = { get: jest.fn() } as unknown as ConfigService;
    service = new FailedEventsConsumerService(
      configServiceMock,
      failedEventsServiceMock as unknown as FailedEventsService,
    );
  });

  function makePayload(rawValue: string | null): EachMessagePayload {
    return {
      topic: 'domain-events.dlq',
      partition: 0,
      message: { value: rawValue === null ? null : Buffer.from(rawValue) },
    } as unknown as EachMessagePayload;
  }

  it('parse 1 DeadLetterEnvelope hop le va goi FailedEventsService.record voi dung du lieu', async () => {
    const envelope: DeadLetterEnvelope = {
      eventId: 'evt-1',
      eventType: 'task.assigned',
      organizationId: 'org-1',
      sourceService: 'notification-service',
      sourceTopic: 'project-task.events',
      errorType: 'RETRY_EXHAUSTED',
      errorMessage: 'Mongo connection timeout',
      attempts: 5,
      rawPayload: '{}',
      failedAt: '2026-07-28T00:00:00.000Z',
    };

    await service['handleMessage'](makePayload(JSON.stringify(envelope)));

    expect(failedEventsServiceMock.record).toHaveBeenCalledWith(envelope);
  });

  it('bo qua (khong throw, khong goi record) khi message JSON khong hop le tren chinh topic DLQ', async () => {
    await expect(
      service['handleMessage'](makePayload('{ khong phai json hop le')),
    ).resolves.toBeUndefined();

    expect(failedEventsServiceMock.record).not.toHaveBeenCalled();
  });

  it('bo qua khi message.value la null', async () => {
    await expect(service['handleMessage'](makePayload(null))).resolves.toBeUndefined();

    expect(failedEventsServiceMock.record).not.toHaveBeenCalled();
  });

  // 26/08/2026: bo sung - fix audit "consumer DLQ rieng nay khong co consumer.on(CRASH,...) nao,
  // khac voi KafkaConsumerService chinh da duoc fix 22/08/2026". Mirror y het bo test tuong ung
  // trong kafka-consumer.service.spec.ts (gan truc tiep 1 mock consumer vao field private
  // `consumer` thay vi goi onModuleInit() that, von tao ket noi Kafka that).
  describe('registerCrashHandler/restartWithBackoff (fix audit "consumer DLQ khong xu ly CRASH")', () => {
    function createMockConsumer() {
      const handlers = new Map<string, (event: unknown) => void>();
      return {
        events: { CRASH: 'consumer.crash' },
        on: jest.fn((event: string, handler: (event: unknown) => void) => handlers.set(event, handler)),
        connect: jest.fn().mockResolvedValue(undefined),
        subscribe: jest.fn().mockResolvedValue(undefined),
        run: jest.fn().mockResolvedValue(undefined),
        triggerCrash(payload: { error: Error; restart: boolean }) {
          handlers.get('consumer.crash')?.({ payload });
        },
      };
    }

    afterEach(() => jest.useRealTimers());

    it('dang ky handler tren event CRASH cua consumer khi khoi tao', () => {
      const mockConsumer = createMockConsumer();
      service['consumer'] = mockConsumer as never;

      service['registerCrashHandler']();

      expect(mockConsumer.on).toHaveBeenCalledWith('consumer.crash', expect.any(Function));
    });

    it('KHONG tu khoi dong lai khi kafkajs tu bao se tu restart (payload.restart=true)', () => {
      const mockConsumer = createMockConsumer();
      service['consumer'] = mockConsumer as never;
      service['registerCrashHandler']();

      mockConsumer.triggerCrash({ error: new Error('loi tam thoi'), restart: true });

      expect(mockConsumer.connect).not.toHaveBeenCalled();
    });

    it('tu khoi dong lai (goi lai connect/subscribe/run) sau backoff khi kafkajs KHONG tu restart (payload.restart=false)', async () => {
      jest.useFakeTimers();
      const mockConsumer = createMockConsumer();
      service['consumer'] = mockConsumer as never;
      service['registerCrashHandler']();

      mockConsumer.triggerCrash({ error: new Error('Kafka mat ket noi keo dai'), restart: false });
      expect(mockConsumer.connect).not.toHaveBeenCalled();

      // Backoff lan dau: 1000 * 2^1 = 2000ms (xem restartWithBackoff()).
      await jest.advanceTimersByTimeAsync(2000);

      expect(mockConsumer.connect).toHaveBeenCalledTimes(1);
      expect(mockConsumer.subscribe).toHaveBeenCalledTimes(1);
      expect(mockConsumer.run).toHaveBeenCalledTimes(1);
    });

    it('thu lai voi backoff TANG DAN neu lan khoi dong lai truoc do cung that bai', async () => {
      jest.useFakeTimers();
      const mockConsumer = createMockConsumer();
      mockConsumer.connect
        .mockRejectedValueOnce(new Error('van chua ket noi duoc'))
        .mockResolvedValueOnce(undefined);
      service['consumer'] = mockConsumer as never;
      service['registerCrashHandler']();

      mockConsumer.triggerCrash({ error: new Error('Kafka mat ket noi keo dai'), restart: false });
      await jest.advanceTimersByTimeAsync(2000); // lan thu 1: that bai
      await jest.advanceTimersByTimeAsync(4000); // lan thu 2 (backoff 1000*2^2=4000ms): thanh cong

      expect(mockConsumer.connect).toHaveBeenCalledTimes(2);
      expect(service['restartAttempt']).toBe(0); // ve 0 sau khi thanh cong
    });

    it('onModuleDestroy() huy timer backoff dang cho - KHONG tu ket noi lai "ma" sau khi da tat', async () => {
      jest.useFakeTimers();
      const mockConsumer = createMockConsumer();
      service['consumer'] = { ...mockConsumer, disconnect: jest.fn().mockResolvedValue(undefined) } as never;
      service['registerCrashHandler']();

      mockConsumer.triggerCrash({ error: new Error('Kafka mat ket noi keo dai'), restart: false });
      // Dang "ngu" giua backoff (2000ms) thi module bi pha huy (vd container redeploy).
      await service.onModuleDestroy();

      await jest.advanceTimersByTimeAsync(30_000); // du de moi backoff toi da (30s) da troi qua.

      expect(mockConsumer.connect).not.toHaveBeenCalled();
    });
  });
});
