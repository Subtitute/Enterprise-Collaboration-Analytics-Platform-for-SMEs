import { ConfigService } from '@nestjs/config';
import { EachMessagePayload } from 'kafkajs';
import { EVENT_TYPES } from '@app/common-dto';
import { KafkaConsumerService } from './kafka-consumer.service';
import { NotificationsService } from '../notifications/notifications.service';

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
 */
describe('KafkaConsumerService (Notification Service)', () => {
  let service: KafkaConsumerService;
  let notificationsServiceMock: { createFromEvent: jest.Mock };

  beforeEach(() => {
    notificationsServiceMock = { createFromEvent: jest.fn().mockResolvedValue({ id: 'notif-1' }) };
    const configServiceMock = { get: jest.fn() } as unknown as ConfigService;
    service = new KafkaConsumerService(
      configServiceMock,
      notificationsServiceMock as unknown as NotificationsService,
    );
  });

  function makePayload(rawValue: string | null): EachMessagePayload {
    return {
      topic: 'project-task.events',
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
});
