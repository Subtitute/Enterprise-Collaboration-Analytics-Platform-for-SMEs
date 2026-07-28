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
});
