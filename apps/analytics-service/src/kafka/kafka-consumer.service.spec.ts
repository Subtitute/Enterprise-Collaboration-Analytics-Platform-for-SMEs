import { ConfigService } from '@nestjs/config';
import { DomainEvent, EVENT_TYPES } from '@app/common-dto';
import { KafkaConsumerService } from './kafka-consumer.service';
import { FactWriterService } from '../analytics/fact-writer.service';
import { AnalyticsGateway } from '../realtime/analytics.gateway';

/**
 * Unit test cho diem review 21/07/2026 (Technical_Spec.md muc 14 - "Kafka consumer chua co
 * DLQ"): loi TAM THOI khi ghi TimescaleDB (FactWriterService.* goi DataSource.query() that bai,
 * vd TimescaleDB down/timeout) phai duoc RETHROW ra khoi `handleEvent` de kafkajs KHONG commit
 * offset cho message do - khac voi truoc day (chi log-and-swallow, lam mat vinh vien event).
 *
 * `handleEvent` la private method duy nhat co the unit-test doc lap (khong can Kafka that) -
 * phan parse JSON nam truc tiep trong callback `eachMessage` cua `consumer.run()` (goi trong
 * `onModuleInit`), yeu cau ket noi Kafka that nen khong unit-test o day.
 */
describe('KafkaConsumerService (Analytics Service) - handleEvent', () => {
  let service: KafkaConsumerService;
  let factWriterMock: {
    recordUserActivity: jest.Mock;
    recordTaskEvent: jest.Mock;
    recordDocumentEvent: jest.Mock;
  };
  let gatewayMock: { emitActivity: jest.Mock };

  const baseEvent: DomainEvent = {
    eventId: 'evt-1',
    eventType: EVENT_TYPES.TASK_CREATED,
    occurredAt: '2026-07-18T09:30:00.000Z',
    organizationId: 'org-1',
    producer: 'project-task-service',
    payload: { taskId: 'task-1', projectId: 'project-1', title: 'Task 1', actorId: 'user-1' },
  };

  beforeEach(() => {
    factWriterMock = {
      recordUserActivity: jest.fn().mockResolvedValue(undefined),
      recordTaskEvent: jest.fn().mockResolvedValue(undefined),
      recordDocumentEvent: jest.fn().mockResolvedValue(undefined),
    };
    gatewayMock = { emitActivity: jest.fn() };

    const configServiceMock = { get: jest.fn() } as unknown as ConfigService;
    service = new KafkaConsumerService(
      configServiceMock,
      factWriterMock as unknown as FactWriterService,
      gatewayMock as unknown as AnalyticsGateway,
    );
  });

  it('ghi fact_user_activity + fact_task_events va day WS khi khong co loi', async () => {
    await service['handleEvent'](baseEvent);

    expect(factWriterMock.recordUserActivity).toHaveBeenCalledWith(baseEvent);
    expect(factWriterMock.recordTaskEvent).toHaveBeenCalledWith(baseEvent);
    expect(factWriterMock.recordDocumentEvent).not.toHaveBeenCalled();
    expect(gatewayMock.emitActivity).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ eventId: 'evt-1' }),
    );
  });

  it('RETHROW loi TAM THOI khi recordUserActivity that bai (vd TimescaleDB down)', async () => {
    const dbError = new Error('TimescaleDB connection timeout');
    factWriterMock.recordUserActivity.mockRejectedValue(dbError);

    await expect(service['handleEvent'](baseEvent)).rejects.toThrow('TimescaleDB connection timeout');

    // Khong duoc day WS neu ghi DB that bai truoc do trong cung 1 event.
    expect(gatewayMock.emitActivity).not.toHaveBeenCalled();
  });

  it('RETHROW loi TAM THOI khi recordTaskEvent (buoc ghi bo sung) that bai', async () => {
    const dbError = new Error('TimescaleDB connection timeout');
    factWriterMock.recordTaskEvent.mockRejectedValue(dbError);

    await expect(service['handleEvent'](baseEvent)).rejects.toThrow('TimescaleDB connection timeout');
    expect(gatewayMock.emitActivity).not.toHaveBeenCalled();
  });

  it('ghi fact_document_events (khong phai fact_task_events) cho eventType bat dau bang "document."', async () => {
    const documentEvent: DomainEvent = {
      ...baseEvent,
      eventType: EVENT_TYPES.DOCUMENT_UPLOADED,
      payload: { fileId: 'file-1', folderId: null, fileName: 'a.pdf', actorId: 'user-1' },
    };

    await service['handleEvent'](documentEvent);

    expect(factWriterMock.recordDocumentEvent).toHaveBeenCalledWith(documentEvent);
    expect(factWriterMock.recordTaskEvent).not.toHaveBeenCalled();
  });
});
