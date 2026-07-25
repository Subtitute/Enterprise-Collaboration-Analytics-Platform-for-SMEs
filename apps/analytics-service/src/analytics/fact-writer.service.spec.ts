import { DataSource } from 'typeorm';
import { DomainEvent, EVENT_TYPES } from '@app/common-dto';
import { FactWriterService } from './fact-writer.service';

/**
 * 25/07/2026: unit test MOI cho FactWriterService (Test-coverage debt - audit): truoc fix nay
 * chi duoc kiem tra GIAN TIEP qua mock trong kafka-consumer.service.spec.ts, chua co test rieng
 * xac minh hanh vi tra ve boolean (RETURNING event_id -> co dong MOI hay khong, xem ghi chu
 * 22/07/2026 trong fact-writer.service.ts) VA hanh vi transactional MOI cua Fix 2 (Major, audit -
 * nhan tham so `runner` tuy chon de goi duoc qua EntityManager cua 1 transaction dang mo thay vi
 * luon dung `this.dataSource` mac dinh).
 *
 * Mock DataSource.query (khong can Postgres/TimescaleDB that) - kiem tra ca 2 nhanh cua
 * `ON CONFLICT ... DO NOTHING RETURNING event_id`: INSERT MOI (rows co 1 phan tu -> true) va
 * INSERT bi bo qua vi trung eventId (rows rong -> false).
 */
describe('FactWriterService', () => {
  let service: FactWriterService;
  let queryMock: jest.Mock;
  let dataSourceMock: Pick<DataSource, 'query'>;

  const baseEvent: DomainEvent = {
    eventId: 'evt-1',
    eventType: EVENT_TYPES.TASK_CREATED,
    occurredAt: '2026-07-25T09:30:00.000Z',
    organizationId: 'org-1',
    producer: 'project-task-service',
    payload: { taskId: 'task-1', projectId: 'project-1', title: 'Task 1', actorId: 'user-1' },
  };

  beforeEach(() => {
    queryMock = jest.fn().mockResolvedValue([{ event_id: 'evt-1' }]);
    dataSourceMock = { query: queryMock };
    service = new FactWriterService(dataSourceMock as DataSource);
  });

  describe('recordUserActivity', () => {
    it('tra ve true khi INSERT tao ban ghi MOI (RETURNING co 1 hang)', async () => {
      queryMock.mockResolvedValueOnce([{ event_id: 'evt-1' }]);

      const result = await service.recordUserActivity(baseEvent);

      expect(result).toBe(true);
      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain('INSERT INTO fact_user_activity');
      expect(sql).toContain('ON CONFLICT (time, event_id) DO NOTHING');
      expect(sql).toContain('RETURNING event_id');
      expect(params).toEqual([
        baseEvent.occurredAt,
        baseEvent.eventId,
        baseEvent.organizationId,
        baseEvent.eventType,
        baseEvent.producer,
        'user-1',
        JSON.stringify(baseEvent.payload),
      ]);
    });

    it('tra ve false khi ON CONFLICT DO NOTHING bo qua ban ghi trung eventId (RETURNING khong co hang nao)', async () => {
      queryMock.mockResolvedValueOnce([]);

      const result = await service.recordUserActivity(baseEvent);

      expect(result).toBe(false);
    });

    // 25/07/2026 (Fix 2 - Major, audit): mac dinh (khong truyen `runner`) phai dung this.dataSource.
    it('mac dinh dung this.dataSource khi khong truyen runner', async () => {
      await service.recordUserActivity(baseEvent);

      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    // 25/07/2026 (Fix 2 - Major, audit): khi duoc goi BEN TRONG 1 transaction, KafkaConsumerService
    // truyen EntityManager cua transaction do lam `runner` - ham PHAI dung runner.query() thay vi
    // this.dataSource.query(), de INSERT nay THUOC VE cung 1 transaction voi cac INSERT khac cua
    // cung event (vd recordTaskEvent) thay vi tu mo 1 connection/transaction rieng.
    it('dung runner.query() (vd EntityManager cua 1 transaction) thay vi this.dataSource.query() khi duoc truyen vao', async () => {
      const managerQueryMock = jest.fn().mockResolvedValue([{ event_id: 'evt-1' }]);
      const managerStub = { query: managerQueryMock };

      const result = await service.recordUserActivity(baseEvent, managerStub as unknown as DataSource);

      expect(result).toBe(true);
      expect(managerQueryMock).toHaveBeenCalledTimes(1);
      // this.dataSource (queryMock) KHONG duoc goi - toan bo INSERT di qua runner duoc truyen vao.
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe('recordTaskEvent', () => {
    it('tra ve true khi INSERT tao ban ghi MOI', async () => {
      queryMock.mockResolvedValueOnce([{ event_id: 'evt-1' }]);

      const result = await service.recordTaskEvent(baseEvent);

      expect(result).toBe(true);
      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain('INSERT INTO fact_task_events');
      expect(sql).toContain('ON CONFLICT (time, event_id) DO NOTHING');
      expect(sql).toContain('RETURNING event_id');
      expect(params).toEqual([
        baseEvent.occurredAt,
        baseEvent.eventId,
        baseEvent.organizationId,
        baseEvent.eventType,
        'project-1',
        'task-1',
        null, // fromStatus - task.created khong co truong nay
        null, // toStatus - task.created khong co truong nay
        'user-1',
      ]);
    });

    it('tra ve false khi ON CONFLICT DO NOTHING bo qua ban ghi trung eventId', async () => {
      queryMock.mockResolvedValueOnce([]);

      const result = await service.recordTaskEvent(baseEvent);

      expect(result).toBe(false);
    });

    it('dung runner.query() thay vi this.dataSource.query() khi duoc truyen vao (Fix 2)', async () => {
      const managerQueryMock = jest.fn().mockResolvedValue([{ event_id: 'evt-1' }]);
      const managerStub = { query: managerQueryMock };

      await service.recordTaskEvent(baseEvent, managerStub as unknown as DataSource);

      expect(managerQueryMock).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe('recordDocumentEvent', () => {
    const documentEvent: DomainEvent = {
      ...baseEvent,
      eventType: EVENT_TYPES.DOCUMENT_UPLOADED,
      payload: { fileId: 'file-1', folderId: 'folder-1', fileName: 'a.pdf', actorId: 'user-1' },
    };

    it('tra ve true khi INSERT tao ban ghi MOI', async () => {
      queryMock.mockResolvedValueOnce([{ event_id: 'evt-1' }]);

      const result = await service.recordDocumentEvent(documentEvent);

      expect(result).toBe(true);
      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain('INSERT INTO fact_document_events');
      expect(sql).toContain('ON CONFLICT (time, event_id) DO NOTHING');
      expect(sql).toContain('RETURNING event_id');
      expect(params).toEqual([
        documentEvent.occurredAt,
        documentEvent.eventId,
        documentEvent.organizationId,
        documentEvent.eventType,
        'file-1',
        'folder-1',
        'user-1',
      ]);
    });

    it('tra ve false khi ON CONFLICT DO NOTHING bo qua ban ghi trung eventId', async () => {
      queryMock.mockResolvedValueOnce([]);

      const result = await service.recordDocumentEvent(documentEvent);

      expect(result).toBe(false);
    });

    it('dung runner.query() thay vi this.dataSource.query() khi duoc truyen vao (Fix 2)', async () => {
      const managerQueryMock = jest.fn().mockResolvedValue([{ event_id: 'evt-1' }]);
      const managerStub = { query: managerQueryMock };

      await service.recordDocumentEvent(documentEvent, managerStub as unknown as DataSource);

      expect(managerQueryMock).toHaveBeenCalledTimes(1);
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  // 25/07/2026 (Fix 2 - Major, audit): chung minh 3 ham co the CHIA SE 1 runner DUY NHAT (mo
  // phong EntityManager cua 1 transaction) - dung tinh huong that ma KafkaConsumerService.handleEvent()
  // tao ra: recordUserActivity() + recordTaskEvent() cho CUNG 1 event, CUNG 1 transaction.
  it('recordUserActivity + recordTaskEvent dung CHUNG 1 runner khi duoc goi trong 1 "transaction" gia lap - khong tach thanh 2 ket noi/transaction rieng', async () => {
    const sharedQueryMock = jest.fn().mockResolvedValue([{ event_id: 'evt-1' }]);
    const sharedManagerStub = { query: sharedQueryMock };

    const isNewEvent = await service.recordUserActivity(baseEvent, sharedManagerStub as unknown as DataSource);
    await service.recordTaskEvent(baseEvent, sharedManagerStub as unknown as DataSource);

    expect(isNewEvent).toBe(true);
    expect(sharedQueryMock).toHaveBeenCalledTimes(2);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
