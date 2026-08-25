import { OutboxPublisherJob } from './outbox-publisher.job';

/**
 * 25/08/2026: unit test cho fix code review CRITICAL (phat hien qua dot ra soat toan du an lan 3) -
 * file nay la ban sao cua apps/iam-service/src/outbox/outbox-publisher.job.ts (file mau tham
 * chieu) nhung truoc ban sua nay CHUA duoc ap dung lai fix da co o apps/project-task-service
 * (22/08/2026): 1 vong for KHONG co try/catch rieng tung record se throw va lam ca tick abort NGAY
 * tai record loi, chan Kafka cho TAT CA to chuc moi tick vi query lay pending toan cuc sap ASC
 * theo createdAt.
 */
describe('OutboxPublisherJob (hrm-service)', () => {
  describe('publishPendingEvents - fix code review 25/08/2026 (1 record loi khong duoc chan cac record khac)', () => {
    it('3 record cho publish, record thu 2 nem loi -> record 1 va 3 van duoc publish + danh dau published, chi record 2 bi bo qua', async () => {
      const makeRecord = (id: string) => ({
        id,
        eventId: `event-${id}`,
        eventType: 'LEAVE_REQUEST_DECIDED',
        organizationId: 'org-1',
        producer: 'hrm-service',
        payload: { leaveRequestId: id },
        occurredAt: new Date('2026-08-25T00:00:00Z'),
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
      const kafkaProducerMock = {
        publish: jest
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('Payload khong hop le cho topic'))
          .mockResolvedValueOnce(undefined),
      };

      const job = new OutboxPublisherJob(outboxRepoMock as any, kafkaProducerMock as any);

      await job.publishPendingEvents();

      expect(kafkaProducerMock.publish).toHaveBeenCalledTimes(3);
      expect(outboxRepoMock.save).toHaveBeenCalledTimes(2);
      expect(record1.published).toBe(true);
      expect(record3.published).toBe(true);
      expect(record2.published).toBe(false);
    });

    it('khong con isRunning bi ket true mai neu 1 record loi (finally van duoc chay)', async () => {
      const record = {
        id: '1',
        eventId: 'event-1',
        eventType: 'LEAVE_REQUEST_DECIDED',
        organizationId: 'org-1',
        producer: 'hrm-service',
        payload: {},
        occurredAt: new Date('2026-08-25T00:00:00Z'),
        published: false,
      };
      const outboxRepoMock = {
        find: jest.fn().mockResolvedValue([record]),
        save: jest.fn().mockResolvedValue(undefined),
      };
      const kafkaProducerMock = {
        publish: jest.fn().mockRejectedValue(new Error('loi khong xac dinh')),
      };

      const job = new OutboxPublisherJob(outboxRepoMock as any, kafkaProducerMock as any);

      await job.publishPendingEvents();
      await job.publishPendingEvents();

      expect(outboxRepoMock.find).toHaveBeenCalledTimes(2);
    });
  });
});
