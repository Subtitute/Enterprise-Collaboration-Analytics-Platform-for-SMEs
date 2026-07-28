import { ConfigService } from '@nestjs/config';
import { EachMessagePayload } from 'kafkajs';
import { EVENT_TYPES, KAFKA_TOPICS } from '@app/common-dto';
import { KafkaConsumerService } from './kafka-consumer.service';
import { NotificationsService } from '../notifications/notifications.service';
// 28/07/2026: mock moi KafkaProducerService - can inject vao constructor tu khi bo sung tinh
// nang day DLQ (xem cac test moi ben duoi).
import { KafkaProducerService } from './kafka-producer.service';

/**
 * Unit test cho diem review 21/07/2026 (Technical_Spec.md muc 14 - "Kafka consumer chua co
 * DLQ"): `handleMessage` phai phan biet 2 loai loi:
 *  - KHONG THE PHUC HOI (JSON hong, eventType khong sinh notification) -> log + bo qua, KHONG
 *    throw, de kafkajs commit offset (retry vo ich).
 *  - TAM THOI (Mongo ghi that bai qua NotificationsService.createFromEvent) -> RETHROW de
 *    kafkajs KHONG commit offset, message duoc consumer group retry.
 *
 * 22/07/2026 - bo sung diem review moi (Fix 2 - poison pill): message JSON hop le VE CU PHAP
 * nhung THIEU truong bat buoc cua DomainEvent (eventId/eventType/organizationId/payload) cung
 * phai duoc log + bo qua (KHONG throw), khong duoc de lot xuong NotificationsService roi bi
 * rethrow nhu loi tam thoi.
 *
 * 28/07/2026 - bo sung DLQ + gioi han retry (nang cap Dead Letter Queue, Technical_Spec.md muc
 * 14): ca 3 nhanh loi "khong the phuc hoi" (MALFORMED_JSON/INVALID_ENVELOPE) + nhanh "het retry"
 * (RETRY_EXHAUSTED, sau 5 lan loi TAM THOI lien tiep cho cung eventId) deu phai publish 1
 * DeadLetterEnvelope vao KAFKA_TOPICS.DLQ qua KafkaProducerService (mock). Loi TAM THOI CON DUOI
 * nguong 5 lan van phai rethrow binh thuong (khong DLQ) - hanh vi cu KHONG duoc thay doi.
 */
describe('KafkaConsumerService (Notification Service)', () => {
  let service: KafkaConsumerService;
  let notificationsServiceMock: { createFromEvent: jest.Mock };
  let kafkaProducerMock: { publish: jest.Mock };

  beforeEach(() => {
    notificationsServiceMock = { createFromEvent: jest.fn().mockResolvedValue({ id: 'notif-1' }) };
    kafkaProducerMock = { publish: jest.fn().mockResolvedValue(undefined) };
    const configServiceMock = { get: jest.fn() } as unknown as ConfigService;
    service = new KafkaConsumerService(
      configServiceMock,
      notificationsServiceMock as unknown as NotificationsService,
      kafkaProducerMock as unknown as KafkaProducerService,
    );
  });

  function makePayload(rawValue: string | null, topic = 'project-task.events'): EachMessagePayload {
    return {
      topic,
      partition: 0,
      message: {
        value: rawValue === null ? null : Buffer.from(rawValue),
      },
    } as unknown as EachMessagePayload;
  }

  it('bo qua (khong throw) khi message JSON khong hop le', async () => {
    await expect(
      service['handleMessage'](makePayload('{ khong phai json hop le')),
    ).resolves.toBeUndefined();

    expect(notificationsServiceMock.createFromEvent).not.toHaveBeenCalled();
  });

  it('bo qua (khong throw) khi eventType khong sinh notification (vd task.status_changed)', async () => {
    const event = {
      eventId: 'evt-1',
      eventType: EVENT_TYPES.TASK_STATUS_CHANGED,
      occurredAt: '2026-07-18T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'project-task-service',
      payload: { taskId: 'task-1', projectId: 'project-1', fromStatus: 'DOING', toStatus: 'DONE', actorId: 'user-1' },
    };

    await expect(service['handleMessage'](makePayload(JSON.stringify(event)))).resolves.toBeUndefined();

    expect(notificationsServiceMock.createFromEvent).not.toHaveBeenCalled();
  });

  it('truyen event.eventId xuong NotificationsService.createFromEvent', async () => {
    const event = {
      eventId: 'evt-2',
      eventType: EVENT_TYPES.TASK_ASSIGNED,
      occurredAt: '2026-07-18T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'project-task-service',
      payload: { taskId: 'task-1', projectId: 'project-1', assigneeId: 'user-1', actorId: 'user-2' },
    };

    await service['handleMessage'](makePayload(JSON.stringify(event)));

    expect(notificationsServiceMock.createFromEvent).toHaveBeenCalledWith(
      'org-1',
      'evt-2',
      expect.objectContaining({ userId: 'user-1' }),
    );
  });

  it('RETHROW loi TAM THOI tu NotificationsService.createFromEvent (vd Mongo down) de kafkajs khong commit offset', async () => {
    const event = {
      eventId: 'evt-3',
      eventType: EVENT_TYPES.DOCUMENT_SHARED,
      occurredAt: '2026-07-18T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'document-service',
      payload: { fileId: 'file-1', sharedWithUserId: 'user-1', actorId: 'user-2' },
    };
    const mongoError = new Error('Mongo connection timeout');
    notificationsServiceMock.createFromEvent.mockRejectedValue(mongoError);

    await expect(service['handleMessage'](makePayload(JSON.stringify(event)))).rejects.toThrow(
      'Mongo connection timeout',
    );
    expect(kafkaProducerMock.publish).not.toHaveBeenCalled();
  });

  // 22/07/2026: bo sung - Fix 2 (poison-pill: envelope thieu truong bat buoc bi bo qua, khong throw).
  it('bo qua (khong throw) khi message JSON hop le nhung thieu organizationId (envelope khong hop le)', async () => {
    const malformedEvent = {
      eventId: 'evt-4',
      eventType: EVENT_TYPES.TASK_ASSIGNED,
      occurredAt: '2026-07-18T09:30:00.000Z',
      organizationId: '',
      producer: 'project-task-service',
      payload: { taskId: 'task-1', projectId: 'project-1', assigneeId: 'user-1', actorId: 'user-2' },
    };

    await expect(
      service['handleMessage'](makePayload(JSON.stringify(malformedEvent))),
    ).resolves.toBeUndefined();

    expect(notificationsServiceMock.createFromEvent).not.toHaveBeenCalled();
  });

  it('bo qua (khong throw) khi message JSON hop le nhung thieu han truong eventId', async () => {
    const malformedEvent = {
      eventType: EVENT_TYPES.TASK_ASSIGNED,
      occurredAt: '2026-07-18T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'project-task-service',
      payload: { taskId: 'task-1', projectId: 'project-1', assigneeId: 'user-1', actorId: 'user-2' },
    };

    await expect(
      service['handleMessage'](makePayload(JSON.stringify(malformedEvent))),
    ).resolves.toBeUndefined();

    expect(notificationsServiceMock.createFromEvent).not.toHaveBeenCalled();
  });

  // 28/07/2026: bo sung - nang cap Dead Letter Queue (Technical_Spec.md muc 14).
  describe('publish DLQ (Technical_Spec.md muc 14 - nang cap Dead Letter Queue)', () => {
    it('day vao DLQ (errorType MALFORMED_JSON) khi message JSON khong hop le', async () => {
      await service['handleMessage'](makePayload('{ khong phai json hop le', 'iam.events'));

      expect(kafkaProducerMock.publish).toHaveBeenCalledTimes(1);
      const [topicArg, envelopeArg] = kafkaProducerMock.publish.mock.calls[0];
      expect(topicArg).toBe(KAFKA_TOPICS.DLQ);
      expect(envelopeArg).toEqual(
        expect.objectContaining({
          eventId: null,
          eventType: null,
          organizationId: null,
          sourceService: 'notification-service',
          sourceTopic: 'iam.events',
          errorType: 'MALFORMED_JSON',
          attempts: 1,
        }),
      );
    });

    it('day vao DLQ (errorType INVALID_ENVELOPE) khi envelope thieu truong bat buoc, lay best-effort cac truong con lai', async () => {
      const malformedEvent = {
        eventId: 'evt-4',
        eventType: EVENT_TYPES.TASK_ASSIGNED,
        occurredAt: '2026-07-18T09:30:00.000Z',
        organizationId: '',
        producer: 'project-task-service',
        payload: { taskId: 'task-1', projectId: 'project-1', assigneeId: 'user-1', actorId: 'user-2' },
      };

      await service['handleMessage'](makePayload(JSON.stringify(malformedEvent)));

      expect(kafkaProducerMock.publish).toHaveBeenCalledTimes(1);
      const [topicArg, envelopeArg] = kafkaProducerMock.publish.mock.calls[0];
      expect(topicArg).toBe(KAFKA_TOPICS.DLQ);
      expect(envelopeArg).toEqual(
        expect.objectContaining({
          eventId: 'evt-4',
          eventType: EVENT_TYPES.TASK_ASSIGNED,
          organizationId: null,
          errorType: 'INVALID_ENVELOPE',
          attempts: 1,
        }),
      );
    });

    it('van RETHROW va KHONG day DLQ khi so lan loi TAM THOI con duoi nguong 5 lan cho cung eventId', async () => {
      const event = {
        eventId: 'evt-retry-under-cap',
        eventType: EVENT_TYPES.DOCUMENT_SHARED,
        occurredAt: '2026-07-18T09:30:00.000Z',
        organizationId: 'org-1',
        producer: 'document-service',
        payload: { fileId: 'file-1', sharedWithUserId: 'user-1', actorId: 'user-2' },
      };
      notificationsServiceMock.createFromEvent.mockRejectedValue(new Error('Mongo timeout'));

      for (let i = 0; i < 4; i++) {
        await expect(service['handleMessage'](makePayload(JSON.stringify(event)))).rejects.toThrow(
          'Mongo timeout',
        );
      }

      expect(kafkaProducerMock.publish).not.toHaveBeenCalled();
    });

    it('sau 5 lan loi TAM THOI lien tiep cho cung eventId, day vao DLQ (RETRY_EXHAUSTED) va KHONG rethrow nua', async () => {
      const event = {
        eventId: 'evt-retry-exhausted',
        eventType: EVENT_TYPES.DOCUMENT_SHARED,
        occurredAt: '2026-07-18T09:30:00.000Z',
        organizationId: 'org-1',
        producer: 'document-service',
        payload: { fileId: 'file-1', sharedWithUserId: 'user-1', actorId: 'user-2' },
      };
      notificationsServiceMock.createFromEvent.mockRejectedValue(new Error('Mongo timeout'));

      for (let i = 0; i < 4; i++) {
        await expect(service['handleMessage'](makePayload(JSON.stringify(event)))).rejects.toThrow(
          'Mongo timeout',
        );
      }
      // Lan thu 5: het nguong retry -> khong rethrow nua, day vao DLQ thay vao do.
      await expect(service['handleMessage'](makePayload(JSON.stringify(event)))).resolves.toBeUndefined();

      expect(kafkaProducerMock.publish).toHaveBeenCalledTimes(1);
      const [topicArg, envelopeArg] = kafkaProducerMock.publish.mock.calls[0];
      expect(topicArg).toBe(KAFKA_TOPICS.DLQ);
      expect(envelopeArg).toEqual(
        expect.objectContaining({
          eventId: 'evt-retry-exhausted',
          eventType: EVENT_TYPES.DOCUMENT_SHARED,
          organizationId: 'org-1',
          errorType: 'RETRY_EXHAUSTED',
          attempts: 5,
        }),
      );
    });

    it('khong publish loi khac vao DLQ khi KafkaProducerService.publish tu no bi loi (log-only, khong crash)', async () => {
      kafkaProducerMock.publish.mockRejectedValue(new Error('Kafka broker khong ket noi duoc'));

      await expect(
        service['handleMessage'](makePayload('{ khong phai json hop le')),
      ).resolves.toBeUndefined();
    });
  });
});
