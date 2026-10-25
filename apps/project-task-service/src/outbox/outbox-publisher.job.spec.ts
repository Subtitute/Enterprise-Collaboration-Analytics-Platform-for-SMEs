import { OutboxPublisherJob } from './outbox-publisher.job';
import configuration, { isOutboxPollingEnabled } from '../config/configuration';

// 25/10/2026 (fix ra soat CDC): job doc co polling qua ConfigService - mock get('outbox.pollingEnabled').
const configMock = (pollingEnabled?: boolean) => ({ get: jest.fn().mockReturnValue(pollingEnabled) }) as any;

/**
 * 22/08/2026: unit test cho fix code review CRITICAL - publishPendingEvents() truoc day dung
 * 1 vong for KHONG co try/catch rieng tung record, nen 1 record loi phi-tam-thoi (payload sai,
 * message qua khuon kho...) se throw va lam ca tick abort NGAY tai record do. Vi query lay
 * pending toan cuc (khong scope theo to chuc) sap ASC theo createdAt, record loi do se ket lai
 * dau hang doi MAI MAI va chan Kafka cho MOI to chuc (Analytics/Notification khong con nhan duoc
 * event nao). Mock thu cong Repository/KafkaProducerService (tuong tu
 * apps/project-task-service/src/tasks/tasks.service.spec.ts) de test logic ma khong can boot
 * NestJS module hay Kafka/DB that.
 */
describe('OutboxPublisherJob', () => {
  describe('publishPendingEvents - fix code review 22/08/2026 (1 record loi khong duoc chan cac record khac)', () => {
    it('3 record cho publish, record thu 2 nem loi -> record 1 va 3 van duoc publish + danh dau published, chi record 2 bi bo qua', async () => {
      const makeRecord = (id: string) => ({
        id,
        eventId: `event-${id}`,
        eventType: 'TASK_CREATED',
        organizationId: 'org-1',
        producer: 'project-task-service',
        payload: { taskId: id },
        occurredAt: new Date('2026-08-22T00:00:00Z'),
        published: false,
      });
      const record1 = makeRecord('1');
      const record2 = makeRecord('2');
      const record3 = makeRecord('3');
      const pending = [record1, record2, record3];

      const outboxRepoMock = {
        find: jest.fn().mockResolvedValue(pending),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };
      // Record 2 that bai vi ly do phi-tam-thoi (vi du payload sai khuon dang topic).
      const kafkaProducerMock = {
        publish: jest
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('Payload khong hop le cho topic'))
          .mockResolvedValueOnce(undefined),
      };

      const job = new OutboxPublisherJob(outboxRepoMock as any, kafkaProducerMock as any, configMock(true));

      await job.publishPendingEvents();

      // Ca 3 record deu duoc THU publish, khong dung lai o record 2.
      expect(kafkaProducerMock.publish).toHaveBeenCalledTimes(3);
      // Chi 2 record thanh cong (1 va 3) duoc luu lai voi published = true.
      expect(outboxRepoMock.save).toHaveBeenCalledTimes(2);
      expect(record1.published).toBe(true);
      expect(record3.published).toBe(true);
      // Record 2 loi thi giu nguyen published = false de tick sau tu retry.
      expect(record2.published).toBe(false);
    });

    it('khong con isRunning bi ket true mai neu 1 record loi (finally van duoc chay)', async () => {
      const record = {
        id: '1',
        eventId: 'event-1',
        eventType: 'TASK_CREATED',
        organizationId: 'org-1',
        producer: 'project-task-service',
        payload: {},
        occurredAt: new Date('2026-08-22T00:00:00Z'),
        published: false,
      };
      const outboxRepoMock = {
        find: jest.fn().mockResolvedValue([record]),
        save: jest.fn().mockResolvedValue(undefined),
      };
      const kafkaProducerMock = {
        publish: jest.fn().mockRejectedValue(new Error('loi khong xac dinh')),
      };

      const job = new OutboxPublisherJob(outboxRepoMock as any, kafkaProducerMock as any, configMock(true));

      await job.publishPendingEvents();
      await job.publishPendingEvents();

      // Neu isRunning bi ket true, lan goi thu 2 se return som va khong goi find() lan nua.
      expect(outboxRepoMock.find).toHaveBeenCalledTimes(2);
    });
  });

  // 25/10/2026 (CDC Debezium): co ENABLE_OUTBOX_POLLING - chi dung 'false' moi tat polling, moi
  // truong hop khac (ke ca khong dat) giu polling BAT de khong bao gio mat su kien. Fix ra soat:
  // ham parse chuyen sang config/configuration.ts, job nhan gia tri qua ConfigService.
  describe('ENABLE_OUTBOX_POLLING', () => {
    it('isOutboxPollingEnabled: chi "false" (khong phan biet hoa thuong/khoang trang) moi tat', () => {
      expect(isOutboxPollingEnabled({})).toBe(true);
      expect(isOutboxPollingEnabled({ ENABLE_OUTBOX_POLLING: 'true' })).toBe(true);
      expect(isOutboxPollingEnabled({ ENABLE_OUTBOX_POLLING: '' })).toBe(true);
      expect(isOutboxPollingEnabled({ ENABLE_OUTBOX_POLLING: 'false' })).toBe(false);
      expect(isOutboxPollingEnabled({ ENABLE_OUTBOX_POLLING: ' FALSE ' })).toBe(false);
    });

    it('configuration(): outbox.pollingEnabled lay tu process.env.ENABLE_OUTBOX_POLLING', () => {
      const original = process.env.ENABLE_OUTBOX_POLLING;
      try {
        process.env.ENABLE_OUTBOX_POLLING = 'False';
        expect(configuration().outbox.pollingEnabled).toBe(false);
        delete process.env.ENABLE_OUTBOX_POLLING;
        expect(configuration().outbox.pollingEnabled).toBe(true);
      } finally {
        if (original === undefined) delete process.env.ENABLE_OUTBOX_POLLING;
        else process.env.ENABLE_OUTBOX_POLLING = original;
      }
    });

    it.each([
      [false, 0],
      [true, 1],
      [undefined, 1],
    ])('outbox.pollingEnabled=%s -> goi find() %i lan', async (value, calls) => {
      const outboxRepoMock = { find: jest.fn().mockResolvedValue([]), save: jest.fn() };
      const config = configMock(value);
      const job = new OutboxPublisherJob(outboxRepoMock as any, { publish: jest.fn() } as any, config);

      await job.publishPendingEvents();

      expect(config.get).toHaveBeenCalledWith('outbox.pollingEnabled');
      expect(outboxRepoMock.find).toHaveBeenCalledTimes(calls);
    });
  });
});
