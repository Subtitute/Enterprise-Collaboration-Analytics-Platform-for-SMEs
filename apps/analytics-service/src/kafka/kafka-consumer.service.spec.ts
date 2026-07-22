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
 *
 * 22/07/2026 - bo sung diem review moi:
 *  1. `recordUserActivity` gio tra ve boolean (co ghi duoc dong MOI hay khong, xem
 *     fact-writer.service.ts) - mac dinh mock resolve `true` (dong MOI) de cac test cu (viet
 *     truoc fix nay, ky vong emitActivity duoc goi) tiep tuc dung; test rieng ben duoi kiem tra
 *     nhanh `false` (event trung) KHONG duoc emitActivity lan 2.
 *  2. `handleEvent` phai bo qua (khong throw) khi event thieu truong bat buoc (envelope khong
 *     hop le) VA khi FactWriterService nem loi DU LIEU vinh vien (Postgres 22P02/23502/23503),
 *     thay vi rethrow giong loi ha tang tam thoi.
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
      recordUserActivity: jest.fn().mockResolvedValue(true),
      recordTaskEvent: jest.fn().mockResolvedValue(true),
      recordDocumentEvent: jest.fn().mockResolvedValue(true),
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

  // 22/07/2026: bo sung - Fix 3 (idempotent WS emit).
  it('KHONG goi emitActivity lan 2 khi recordUserActivity tra ve false (eventId da duoc ghi tu 1 lan xu ly truoc - trung lap Outbox)', async () => {
    factWriterMock.recordUserActivity.mockResolvedValue(false);

    await service['handleEvent'](baseEvent);

    // Van ghi bo sung fact_task_events binh thuong (idempotent rieng o muc SQL, ON CONFLICT DO
    // NOTHING) - chi rieng emitActivity la khong duoc goi lai.
    expect(factWriterMock.recordTaskEvent).toHaveBeenCalledWith(baseEvent);
    expect(gatewayMock.emitActivity).not.toHaveBeenCalled();
  });

  // 22/07/2026: bo sung - Fix 2 (poison-pill: envelope khong hop le bi bo qua, khong throw).
  it('bo qua (khong throw) khi event thieu truong bat buoc (vd organizationId rong) - KHONG goi FactWriterService', async () => {
    const malformedEvent = { ...baseEvent, organizationId: '' } as DomainEvent;

    await expect(service['handleEvent'](malformedEvent)).resolves.toBeUndefined();

    expect(factWriterMock.recordUserActivity).not.toHaveBeenCalled();
    expect(factWriterMock.recordTaskEvent).not.toHaveBeenCalled();
    expect(gatewayMock.emitActivity).not.toHaveBeenCalled();
  });

  it('bo qua (khong throw) khi event thieu han truong payload', async () => {
    const malformedEvent = { ...baseEvent, payload: undefined } as unknown as DomainEvent;

    await expect(service['handleEvent'](malformedEvent)).resolves.toBeUndefined();

    expect(factWriterMock.recordUserActivity).not.toHaveBeenCalled();
  });

  // 22/07/2026: bo sung - Fix 2 (loi DU LIEU vinh vien tu Postgres bi log-and-skip, khong rethrow).
  it('bo qua (khong throw) khi FactWriterService nem loi Postgres 23502 (not-null violation)', async () => {
    const dataError = Object.assign(new Error('null value in column "task_id" violates not-null constraint'), {
      code: '23502',
    });
    factWriterMock.recordTaskEvent.mockRejectedValue(dataError);

    await expect(service['handleEvent'](baseEvent)).resolves.toBeUndefined();

    expect(gatewayMock.emitActivity).not.toHaveBeenCalled();
  });

  it('van RETHROW loi Postgres KHAC ma khong nam trong danh sach loi vinh vien (vd ma loi ket noi)', async () => {
    const connError = Object.assign(new Error('connection terminated unexpectedly'), { code: 'ECONNREFUSED' });
    factWriterMock.recordTaskEvent.mockRejectedValue(connError);

    await expect(service['handleEvent'](baseEvent)).rejects.toThrow('connection terminated unexpectedly');
  });
});
