import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DomainEvent, EVENT_TYPES, KAFKA_TOPICS } from '@app/common-dto';
import { KafkaConsumerService } from './kafka-consumer.service';
import { FactWriterService } from '../analytics/fact-writer.service';
import { AnalyticsGateway } from '../realtime/analytics.gateway';
// 28/07/2026: mock moi cho producer DLQ (xem cac test RETRY_EXHAUSTED/MALFORMED_JSON/... ben duoi).
import { KafkaProducerService } from './kafka-producer.service';

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
 *
 * 25/07/2026 (Fix 2 - Major, audit): `handleEvent` gio can them 1 DataSource (mock qua
 * `dataSourceMock` ben duoi) de mo transaction boc quanh cac loi goi FactWriterService.* -
 * `dataSourceMock.transaction` duoc mock de CHAY THAT callback truyen vao (gia lap transaction
 * luon "thanh cong" tru khi callback tu nem loi), truyen vao 1 `managerStub` gia lap
 * EntityManager de cac assertion ben duoi kiem tra dung FactWriterService.* duoc goi VOI tham so
 * thu 2 la manager cua transaction (khong con la DataSource nhu truoc fix nay).
 *
 * 28/07/2026 (Dead Letter Queue, Technical_Spec.md muc 14 - nay da co DLQ):
 *  1. `handleEvent` gio nhan them tham so `topic` (thread tu processMessage()/eachMessage()) -
 *     TOAN BO loi goi `service['handleEvent'](...)` ben duoi duoc cap nhat them tham so nay
 *     (hang so `TOPIC`).
 *  2. Bo sung mock `kafkaProducerMock` (KafkaProducerService.publish) - ca 4 nhanh loi cua
 *     service (MALFORMED_JSON, INVALID_ENVELOPE, PERMANENT_DATA_ERROR, RETRY_EXHAUSTED) gio phai
 *     goi `kafkaProducerMock.publish(KAFKA_TOPICS.DLQ, ...)` thay vi CHI log-and-skip nhu truoc.
 *  3. Nhanh MALFORMED_JSON nam trong `processMessage()` (tach tu callback `eachMessage()` de co
 *     the unit-test duoc ma khong can Kafka that, xem kafka-consumer.service.ts) - test rieng qua
 *     `service['processMessage'](topic, buffer)` thay vi `handleEvent()`.
 *  4. Nhom test moi "gioi han retry cho loi TAM THOI (RETRY_EXHAUSTED)" goi `handleEvent()` NHIEU
 *     LAN LIEN TIEP voi CUNG 1 eventId de mo phong Map `retryAttempts` (trong bo nho, theo tung
 *     instance service) cong don dan toi nguong `maxRetryAttempts = 5`.
 */
describe('KafkaConsumerService (Analytics Service) - handleEvent', () => {
  let service: KafkaConsumerService;
  let factWriterMock: {
    recordUserActivity: jest.Mock;
    recordTaskEvent: jest.Mock;
    recordDocumentEvent: jest.Mock;
    // 28/07/2026: mock moi - nhanh USER_REGISTERED/USER_DEPARTMENT_CHANGED cua handleEvent().
    upsertUserDepartment: jest.Mock;
  };
  let gatewayMock: { emitActivity: jest.Mock };
  let dataSourceMock: { transaction: jest.Mock };
  // 28/07/2026: mock KafkaProducerService - chi can `publish` vi day la method DUY NHAT service
  // nay goi tren KafkaProducerService (xem publishToDlq() trong kafka-consumer.service.ts).
  let kafkaProducerMock: { publish: jest.Mock };
  const managerStub = { query: jest.fn() };
  // 28/07/2026: topic Kafka GOC dung chung cho cac test ben duoi (chi can 1 gia tri co dinh de
  // thread qua handleEvent()/processMessage(), khong can khop chinh xac EVENT_TYPE_TOPIC_MAP).
  const TOPIC = KAFKA_TOPICS.PROJECT_TASK;

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
      // 28/07/2026: upsertUserDepartment() khong tra ve gia tri co y nghia (Promise<void>) - mock
      // resolve undefined, cung ly do nhu 3 ham con lai deu mac dinh "thanh cong".
      upsertUserDepartment: jest.fn().mockResolvedValue(undefined),
    };
    gatewayMock = { emitActivity: jest.fn() };
    // 25/07/2026: mo phong dataSource.transaction() CHAY THAT callback (giong hanh vi that cua
    // TypeORM khi transaction thanh cong) - propagate loi neu callback nem loi, giong ROLLBACK
    // that.
    dataSourceMock = {
      transaction: jest.fn(async (cb: (manager: unknown) => Promise<void>) => cb(managerStub)),
    };
    // 28/07/2026: mac dinh publish() resolve thanh cong - cac test rieng ve loi publish DLQ (neu
    // can) se override bang mockRejectedValue.
    kafkaProducerMock = { publish: jest.fn().mockResolvedValue(undefined) };

    const configServiceMock = { get: jest.fn() } as unknown as ConfigService;
    service = new KafkaConsumerService(
      configServiceMock,
      factWriterMock as unknown as FactWriterService,
      gatewayMock as unknown as AnalyticsGateway,
      dataSourceMock as unknown as DataSource,
      // 28/07/2026: tham so moi thu 5 - KafkaProducerService (xem constructor trong
      // kafka-consumer.service.ts).
      kafkaProducerMock as unknown as KafkaProducerService,
    );
  });

  it('ghi fact_user_activity + fact_task_events (trong CUNG 1 transaction) va day WS khi khong co loi', async () => {
    await service['handleEvent'](baseEvent, TOPIC);

    expect(dataSourceMock.transaction).toHaveBeenCalledTimes(1);
    expect(factWriterMock.recordUserActivity).toHaveBeenCalledWith(baseEvent, managerStub);
    expect(factWriterMock.recordTaskEvent).toHaveBeenCalledWith(baseEvent, managerStub);
    expect(factWriterMock.recordDocumentEvent).not.toHaveBeenCalled();
    expect(gatewayMock.emitActivity).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ eventId: 'evt-1' }),
    );
    // 28/07/2026: duong thanh cong khong duoc day gi vao DLQ.
    expect(kafkaProducerMock.publish).not.toHaveBeenCalled();
  });

  it('RETHROW loi TAM THOI khi recordUserActivity that bai (vd TimescaleDB down)', async () => {
    const dbError = new Error('TimescaleDB connection timeout');
    factWriterMock.recordUserActivity.mockRejectedValue(dbError);

    await expect(service['handleEvent'](baseEvent, TOPIC)).rejects.toThrow('TimescaleDB connection timeout');

    // Khong duoc day WS neu ghi DB that bai truoc do trong cung 1 event.
    expect(gatewayMock.emitActivity).not.toHaveBeenCalled();
    // 28/07/2026: moi that bai dau tien (attempt 1/5) - CHUA toi nguong nen chua day DLQ.
    expect(kafkaProducerMock.publish).not.toHaveBeenCalled();
  });

  it('RETHROW loi TAM THOI khi recordTaskEvent (buoc ghi bo sung) that bai', async () => {
    const dbError = new Error('TimescaleDB connection timeout');
    factWriterMock.recordTaskEvent.mockRejectedValue(dbError);

    await expect(service['handleEvent'](baseEvent, TOPIC)).rejects.toThrow('TimescaleDB connection timeout');
    expect(gatewayMock.emitActivity).not.toHaveBeenCalled();
  });

  // 25/07/2026 (Fix 2 - Major, audit): chung minh hanh vi atomic - ca recordUserActivity()
  // (ghi thanh cong) VA recordTaskEvent() (that bai TAM THOI) deu nam trong 1 dataSource.transaction()
  // DUY NHAT, nen khi callback nem loi, TypeORM ROLLBACK CA HAI (khong con truong hop
  // recordUserActivity() "sot lai" 1 minh nhu loi truoc fix nay). Kafka redeliver cung eventId
  // o lan sau se coi day la lan xu ly DAU TIEN (isNewEvent=true) dung nhu ban chat, thay vi bi
  // "ket" o false vinh vien (mat WS push) du fact table cuoi cung day du/dung.
  it('sau khi transaction ROLLBACK vi loi TAM THOI, lan Kafka redeliver TIEP THEO van duoc coi la event MOI (isNewEvent=true) va day WS binh thuong', async () => {
    const dbError = new Error('TimescaleDB connection timeout');
    factWriterMock.recordTaskEvent.mockRejectedValueOnce(dbError);

    await expect(service['handleEvent'](baseEvent, TOPIC)).rejects.toThrow('TimescaleDB connection timeout');
    expect(gatewayMock.emitActivity).not.toHaveBeenCalled();

    // Lan redeliver: khong con dbError, recordUserActivity() (mac dinh mock resolve true trong
    // beforeEach) lai tra ve isNewEvent=true dung nhu that (vi lan truoc da ROLLBACK, KHONG co
    // ban ghi nao ton tai truoc do de recordUserActivity() dung ON CONFLICT DO NOTHING).
    await service['handleEvent'](baseEvent, TOPIC);

    expect(gatewayMock.emitActivity).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ eventId: 'evt-1' }),
    );
  });

  it('ghi fact_document_events (khong phai fact_task_events) cho eventType bat dau bang "document."', async () => {
    const documentEvent: DomainEvent = {
      ...baseEvent,
      eventType: EVENT_TYPES.DOCUMENT_UPLOADED,
      payload: { fileId: 'file-1', folderId: null, fileName: 'a.pdf', actorId: 'user-1' },
    };

    await service['handleEvent'](documentEvent, TOPIC);

    // 25/07/2026: tham so thu 2 gio la manager cua transaction (xem Fix 2), khong con la
    // undefined/tham so mac dinh nhu truoc.
    expect(factWriterMock.recordDocumentEvent).toHaveBeenCalledWith(documentEvent, managerStub);
    expect(factWriterMock.recordTaskEvent).not.toHaveBeenCalled();
  });

  // 28/07/2026: bo sung - nhanh MOI cua handleEvent() cho KPI theo phong ban (dim_user), goi qua
  // EVENT_TYPES.USER_REGISTERED/USER_DEPARTMENT_CHANGED (topic KAFKA_TOPICS.IAM).
  describe('cap nhat dim_user tu event USER_REGISTERED/USER_DEPARTMENT_CHANGED (KPI theo phong ban)', () => {
    const registeredEvent: DomainEvent = {
      ...baseEvent,
      eventType: EVENT_TYPES.USER_REGISTERED,
      payload: { userId: 'user-1', email: 'a@example.com', departmentId: 'dept-1' },
    };

    it('goi upsertUserDepartment() (khong phai recordTaskEvent/recordDocumentEvent) cho event USER_REGISTERED, trong CUNG transaction', async () => {
      await service['handleEvent'](registeredEvent, KAFKA_TOPICS.IAM);

      expect(factWriterMock.upsertUserDepartment).toHaveBeenCalledWith(registeredEvent, managerStub);
      expect(factWriterMock.recordTaskEvent).not.toHaveBeenCalled();
      expect(factWriterMock.recordDocumentEvent).not.toHaveBeenCalled();
      // van ghi fact_user_activity nhu MOI event khac (buoc 1 chung, khong doi).
      expect(factWriterMock.recordUserActivity).toHaveBeenCalledWith(registeredEvent, managerStub);
    });

    it('goi upsertUserDepartment() cho event USER_DEPARTMENT_CHANGED (bao gom ca ban resync dinh ky tu IAM Service, departmentId co the null)', async () => {
      const departmentChangedEvent: DomainEvent = {
        ...baseEvent,
        eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
        payload: { userId: 'user-1', departmentId: null },
      };

      await service['handleEvent'](departmentChangedEvent, KAFKA_TOPICS.IAM);

      expect(factWriterMock.upsertUserDepartment).toHaveBeenCalledWith(departmentChangedEvent, managerStub);
    });

    it('day WS activity binh thuong (isNewEvent=true) sau khi upsertUserDepartment() thanh cong', async () => {
      await service['handleEvent'](registeredEvent, KAFKA_TOPICS.IAM);

      expect(gatewayMock.emitActivity).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ eventId: registeredEvent.eventId }),
      );
    });

    it('RETHROW loi TAM THOI khi upsertUserDepartment that bai (vd TimescaleDB down), giong 2 ham ghi fact table kia', async () => {
      const dbError = new Error('TimescaleDB connection timeout');
      factWriterMock.upsertUserDepartment.mockRejectedValue(dbError);

      await expect(service['handleEvent'](registeredEvent, KAFKA_TOPICS.IAM)).rejects.toThrow(
        'TimescaleDB connection timeout',
      );
      expect(gatewayMock.emitActivity).not.toHaveBeenCalled();
    });
  });

  // 22/07/2026: bo sung - Fix 3 (idempotent WS emit).
  it('KHONG goi emitActivity lan 2 khi recordUserActivity tra ve false (eventId da duoc ghi tu 1 lan xu ly truoc - trung lap Outbox)', async () => {
    factWriterMock.recordUserActivity.mockResolvedValue(false);

    await service['handleEvent'](baseEvent, TOPIC);

    // Van ghi bo sung fact_task_events binh thuong (idempotent rieng o muc SQL, ON CONFLICT DO
    // NOTHING) - chi rieng emitActivity la khong duoc goi lai.
    expect(factWriterMock.recordTaskEvent).toHaveBeenCalledWith(baseEvent, managerStub);
    expect(gatewayMock.emitActivity).not.toHaveBeenCalled();
  });

  // 22/07/2026: bo sung - Fix 2 (poison-pill: envelope khong hop le bi bo qua, khong throw).
  // 28/07/2026: bo sung assertion DLQ (errorType INVALID_ENVELOPE).
  it('bo qua (khong throw) khi event thieu truong bat buoc (vd organizationId rong) - KHONG goi FactWriterService, day sang DLQ', async () => {
    const malformedEvent = { ...baseEvent, organizationId: '' } as DomainEvent;

    await expect(service['handleEvent'](malformedEvent, TOPIC)).resolves.toBeUndefined();

    expect(factWriterMock.recordUserActivity).not.toHaveBeenCalled();
    expect(factWriterMock.recordTaskEvent).not.toHaveBeenCalled();
    expect(gatewayMock.emitActivity).not.toHaveBeenCalled();
    expect(kafkaProducerMock.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.DLQ,
      expect.objectContaining({
        errorType: 'INVALID_ENVELOPE',
        eventId: 'evt-1',
        eventType: EVENT_TYPES.TASK_CREATED,
        organizationId: '',
        sourceTopic: TOPIC,
        sourceService: 'analytics-service',
        attempts: 1,
      }),
    );
  });

  it('bo qua (khong throw) khi event thieu han truong payload, day sang DLQ (INVALID_ENVELOPE)', async () => {
    const malformedEvent = { ...baseEvent, payload: undefined } as unknown as DomainEvent;

    await expect(service['handleEvent'](malformedEvent, TOPIC)).resolves.toBeUndefined();

    expect(factWriterMock.recordUserActivity).not.toHaveBeenCalled();
    expect(kafkaProducerMock.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.DLQ,
      expect.objectContaining({ errorType: 'INVALID_ENVELOPE', eventId: 'evt-1', sourceTopic: TOPIC }),
    );
  });

  // 22/07/2026: bo sung - Fix 2 (loi DU LIEU vinh vien tu Postgres bi log-and-skip, khong rethrow).
  // 28/07/2026: bo sung assertion DLQ (errorType PERMANENT_DATA_ERROR).
  it('bo qua (khong throw) khi FactWriterService nem loi Postgres 23502 (not-null violation), day sang DLQ', async () => {
    const dataError = Object.assign(new Error('null value in column "task_id" violates not-null constraint'), {
      code: '23502',
    });
    factWriterMock.recordTaskEvent.mockRejectedValue(dataError);

    await expect(service['handleEvent'](baseEvent, TOPIC)).resolves.toBeUndefined();

    expect(gatewayMock.emitActivity).not.toHaveBeenCalled();
    expect(kafkaProducerMock.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.DLQ,
      expect.objectContaining({
        errorType: 'PERMANENT_DATA_ERROR',
        eventId: 'evt-1',
        eventType: EVENT_TYPES.TASK_CREATED,
        organizationId: 'org-1',
        sourceTopic: TOPIC,
        attempts: 1,
        errorMessage: dataError.message,
      }),
    );
  });

  it('van RETHROW loi Postgres KHAC ma khong nam trong danh sach loi vinh vien (vd ma loi ket noi)', async () => {
    const connError = Object.assign(new Error('connection terminated unexpectedly'), { code: 'ECONNREFUSED' });
    factWriterMock.recordTaskEvent.mockRejectedValue(connError);

    await expect(service['handleEvent'](baseEvent, TOPIC)).rejects.toThrow('connection terminated unexpectedly');
    // 28/07/2026: attempt 1/5 - chua toi nguong retry nen chua day DLQ.
    expect(kafkaProducerMock.publish).not.toHaveBeenCalled();
  });

  // 28/07/2026: test moi - nhanh MALFORMED_JSON gio nam trong processMessage() (tach tu callback
  // eachMessage() de co the goi truc tiep trong unit test, xem kafka-consumer.service.ts).
  it('processMessage(): day sang DLQ (errorType MALFORMED_JSON) va KHONG throw khi noi dung message khong phai JSON hop le', async () => {
    const rawValue = Buffer.from('{ day khong phai JSON hop le');

    await expect(service['processMessage'](TOPIC, rawValue)).resolves.toBeUndefined();

    expect(factWriterMock.recordUserActivity).not.toHaveBeenCalled();
    expect(kafkaProducerMock.publish).toHaveBeenCalledWith(
      KAFKA_TOPICS.DLQ,
      expect.objectContaining({
        errorType: 'MALFORMED_JSON',
        eventId: null,
        eventType: null,
        organizationId: null,
        sourceTopic: TOPIC,
        sourceService: 'analytics-service',
        attempts: 1,
        rawPayload: rawValue.toString(),
      }),
    );
  });

  // 28/07/2026: nhom test moi - gioi han so lan retry (maxRetryAttempts = 5) cho loi TAM THOI,
  // dem theo Map `retryAttempts` (trong bo nho, key la eventId) cua CUNG 1 instance service.
  describe('gioi han retry cho loi TAM THOI (RETRY_EXHAUSTED)', () => {
    it('van RETHROW va CHUA day DLQ khi so lan that bai LIEN TIEP cho CUNG eventId con duoi nguong (4/5)', async () => {
      const dbError = new Error('TimescaleDB connection timeout');
      factWriterMock.recordTaskEvent.mockRejectedValue(dbError);

      for (let i = 0; i < 4; i += 1) {
        await expect(service['handleEvent'](baseEvent, TOPIC)).rejects.toThrow('TimescaleDB connection timeout');
      }

      expect(kafkaProducerMock.publish).not.toHaveBeenCalled();
    });

    it('day sang DLQ (errorType RETRY_EXHAUSTED, attempts=5) va KHONG rethrow o lan that bai LIEN TIEP thu 5 cho CUNG eventId', async () => {
      const dbError = new Error('TimescaleDB connection timeout');
      factWriterMock.recordTaskEvent.mockRejectedValue(dbError);

      // 4 lan dau van rethrow binh thuong (chua toi nguong).
      for (let i = 0; i < 4; i += 1) {
        await expect(service['handleEvent'](baseEvent, TOPIC)).rejects.toThrow('TimescaleDB connection timeout');
      }
      expect(kafkaProducerMock.publish).not.toHaveBeenCalled();

      // Lan thu 5 (LIEN TIEP, cung eventId) - vuot nguong, day DLQ va KHONG rethrow nua.
      await expect(service['handleEvent'](baseEvent, TOPIC)).resolves.toBeUndefined();

      expect(kafkaProducerMock.publish).toHaveBeenCalledTimes(1);
      expect(kafkaProducerMock.publish).toHaveBeenCalledWith(
        KAFKA_TOPICS.DLQ,
        expect.objectContaining({
          errorType: 'RETRY_EXHAUSTED',
          eventId: 'evt-1',
          eventType: EVENT_TYPES.TASK_CREATED,
          organizationId: 'org-1',
          sourceTopic: TOPIC,
          attempts: 5,
          errorMessage: 'TimescaleDB connection timeout',
        }),
      );
    });
  });

  // 25/08/2026: bo sung (phat hien qua dot ra soat toan du an lan 3 - service nay co cung logic
  // registerCrashHandler()/restartWithBackoff() voi notification-service tu 22/08/2026 nhung chua
  // tung co test rieng nao cho no) - mirror dung
  // apps/notification-service/src/kafka/kafka-consumer.service.spec.ts. Gan truc tiep 1 mock
  // consumer vao field private `consumer` (thay vi goi onModuleInit() that).
  describe('registerCrashHandler/restartWithBackoff (fix audit "Kafka consumer CRASH khong duoc xu ly")', () => {
    function createMockConsumer() {
      const handlers = new Map<string, (event: unknown) => void>();
      return {
        events: { CRASH: 'consumer.crash' },
        on: jest.fn((event: string, handler: (event: unknown) => void) => handlers.set(event, handler)),
        connect: jest.fn().mockResolvedValue(undefined),
        subscribe: jest.fn().mockResolvedValue(undefined),
        run: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
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

    // 25/08/2026: fix code review Minor (phat hien qua dot ra soat toan du an lan 3) - truoc ban
    // sua nay, onModuleDestroy() khong huy timer backoff dang cho, nen module bi pha huy DUNG luc
    // dang "ngu" giua 1 lan backoff van tu ket noi lai "ma" sau khi da coi la tat xong.
    it('onModuleDestroy() huy timer backoff dang cho - KHONG tu ket noi lai "ma" sau khi da tat', async () => {
      jest.useFakeTimers();
      const mockConsumer = createMockConsumer();
      service['consumer'] = mockConsumer as never;
      service['registerCrashHandler']();

      mockConsumer.triggerCrash({ error: new Error('Kafka mat ket noi keo dai'), restart: false });
      await service.onModuleDestroy();

      await jest.advanceTimersByTimeAsync(30_000);

      expect(mockConsumer.connect).not.toHaveBeenCalled();
    });
  });
});
