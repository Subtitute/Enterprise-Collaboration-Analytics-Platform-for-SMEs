import { ConfigService } from '@nestjs/config';
import { EachMessagePayload } from 'kafkajs';
import { EVENT_TYPES, KAFKA_TOPICS } from '@app/common-dto';
import { KafkaConsumerService } from './kafka-consumer.service';
import { NotificationsService } from '../notifications/notifications.service';
// 28/07/2026: mock moi KafkaProducerService - can inject vao constructor tu khi bo sung tinh
// nang day DLQ (xem cac test moi ben duoi).
import { KafkaProducerService } from './kafka-producer.service';
import { OrgMembersService } from '../org-members/org-members.service';
import { DepartmentManagersService } from '../department-managers/department-managers.service';

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
  let orgMembersServiceMock: {
    markActive: jest.Mock;
    markInactive: jest.Mock;
    setDepartment: jest.Mock;
    listActiveUserIds: jest.Mock;
  };
  let departmentManagersServiceMock: { setManager: jest.Mock };

  beforeEach(() => {
    notificationsServiceMock = { createFromEvent: jest.fn().mockResolvedValue({ id: 'notif-1' }) };
    kafkaProducerMock = { publish: jest.fn().mockResolvedValue(undefined) };
    orgMembersServiceMock = {
      markActive: jest.fn().mockResolvedValue(undefined),
      markInactive: jest.fn().mockResolvedValue(undefined),
      setDepartment: jest.fn().mockResolvedValue(undefined),
      listActiveUserIds: jest.fn().mockResolvedValue([]),
    };
    departmentManagersServiceMock = { setManager: jest.fn().mockResolvedValue(undefined) };
    const configServiceMock = { get: jest.fn() } as unknown as ConfigService;
    service = new KafkaConsumerService(
      configServiceMock,
      notificationsServiceMock as unknown as NotificationsService,
      kafkaProducerMock as unknown as KafkaProducerService,
      orgMembersServiceMock as unknown as OrgMembersService,
      departmentManagersServiceMock as unknown as DepartmentManagersService,
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

  // 17/09/2026: bo sung - syncOrgMembership() (read-model danh sach thanh vien active) +
  // buildBroadcastNotificationTemplate() (thong bao toan to chuc, vd cong bo ngay nghi le).
  describe('syncOrgMembership + fan-out thong bao toan to chuc (bo sung 17/09/2026)', () => {
    it('USER_REGISTERED: ghi nhan thanh vien active, KHONG sinh notification (van la eventType khong sinh thong bao)', async () => {
      const event = {
        eventId: 'evt-reg-1',
        eventType: EVENT_TYPES.USER_REGISTERED,
        occurredAt: '2026-09-17T09:00:00.000Z',
        organizationId: 'org-1',
        producer: 'iam-service',
        payload: { userId: 'user-1', email: 'a@demo-sme.vn', departmentId: null },
      };

      await expect(service['handleMessage'](makePayload(JSON.stringify(event), 'iam.events'))).resolves.toBeUndefined();

      expect(orgMembersServiceMock.markActive).toHaveBeenCalledWith('org-1', 'user-1', null);
      expect(notificationsServiceMock.createFromEvent).not.toHaveBeenCalled();
    });

    it('USER_DEPARTMENT_CHANGED: dong bo departmentId moi cua 1 user da ton tai', async () => {
      const event = {
        eventId: 'evt-dept-1',
        eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
        occurredAt: '2026-09-23T09:00:00.000Z',
        organizationId: 'org-1',
        producer: 'iam-service',
        payload: { userId: 'user-1', departmentId: 'dept-2' },
      };

      await service['handleMessage'](makePayload(JSON.stringify(event), 'iam.events'));

      expect(orgMembersServiceMock.setDepartment).toHaveBeenCalledWith('org-1', 'user-1', 'dept-2');
    });

    it('DEPARTMENT_MANAGER_CHANGED: dong bo nguoi phu trach moi cua 1 phong ban', async () => {
      const event = {
        eventId: 'evt-mgr-1',
        eventType: EVENT_TYPES.DEPARTMENT_MANAGER_CHANGED,
        occurredAt: '2026-09-23T09:00:00.000Z',
        organizationId: 'org-1',
        producer: 'iam-service',
        payload: { departmentId: 'dept-2', managerId: 'user-9' },
      };

      await service['handleMessage'](makePayload(JSON.stringify(event), 'iam.events'));

      expect(departmentManagersServiceMock.setManager).toHaveBeenCalledWith('org-1', 'dept-2', 'user-9');
      expect(notificationsServiceMock.createFromEvent).not.toHaveBeenCalled();
    });

    it('USER_DEACTIVATED: danh dau thanh vien khong con active', async () => {
      const event = {
        eventId: 'evt-deact-1',
        eventType: EVENT_TYPES.USER_DEACTIVATED,
        occurredAt: '2026-09-17T09:00:00.000Z',
        organizationId: 'org-1',
        producer: 'iam-service',
        payload: { userId: 'user-1', actorId: 'admin-1' },
      };

      await service['handleMessage'](makePayload(JSON.stringify(event), 'iam.events'));

      expect(orgMembersServiceMock.markInactive).toHaveBeenCalledWith('org-1', 'user-1');
    });

    it('CALENDAR_EVENT_CREATED (type=HOLIDAY): fan-out 1 notification cho MOI thanh vien active, dung chung eventId', async () => {
      orgMembersServiceMock.listActiveUserIds.mockResolvedValue(['user-1', 'user-2', 'user-3']);
      const event = {
        eventId: 'evt-holiday-1',
        eventType: EVENT_TYPES.CALENDAR_EVENT_CREATED,
        occurredAt: '2026-09-17T09:00:00.000Z',
        organizationId: 'org-1',
        producer: 'hrm-service',
        payload: {
          calendarEventId: 'cal-1',
          title: 'Tet Nguyen Dan',
          type: 'HOLIDAY',
          startDate: '2027-02-05',
          endDate: '2027-02-09',
          actorId: 'admin-1',
        },
      };

      await service['handleMessage'](makePayload(JSON.stringify(event), 'hrm.events'));

      expect(orgMembersServiceMock.listActiveUserIds).toHaveBeenCalledWith('org-1');
      expect(notificationsServiceMock.createFromEvent).toHaveBeenCalledTimes(3);
      for (const uid of ['user-1', 'user-2', 'user-3']) {
        expect(notificationsServiceMock.createFromEvent).toHaveBeenCalledWith(
          'org-1',
          'evt-holiday-1',
          expect.objectContaining({ userId: uid, type: EVENT_TYPES.CALENDAR_EVENT_CREATED }),
        );
      }
    });

    it('CALENDAR_EVENT_CREATED (type=EVENT, khong phai HOLIDAY): KHONG fan-out, khong sinh notification nao', async () => {
      const event = {
        eventId: 'evt-cal-event-1',
        eventType: EVENT_TYPES.CALENDAR_EVENT_CREATED,
        occurredAt: '2026-09-17T09:00:00.000Z',
        organizationId: 'org-1',
        producer: 'hrm-service',
        payload: {
          calendarEventId: 'cal-2',
          title: 'Hop toan cong ty',
          type: 'EVENT',
          startDate: '2027-03-01',
          endDate: '2027-03-01',
          actorId: 'admin-1',
        },
      };

      await service['handleMessage'](makePayload(JSON.stringify(event), 'hrm.events'));

      expect(orgMembersServiceMock.listActiveUserIds).not.toHaveBeenCalled();
      expect(notificationsServiceMock.createFromEvent).not.toHaveBeenCalled();
    });

    it('RETHROW khi syncOrgMembership loi TAM THOI (vd Mongo down) - mirror hanh vi loi cua createFromEvent', async () => {
      orgMembersServiceMock.markActive.mockRejectedValue(new Error('Mongo connection timeout'));
      const event = {
        eventId: 'evt-reg-2',
        eventType: EVENT_TYPES.USER_REGISTERED,
        occurredAt: '2026-09-17T09:00:00.000Z',
        organizationId: 'org-1',
        producer: 'iam-service',
        payload: { userId: 'user-1', email: 'a@demo-sme.vn', departmentId: null },
      };

      await expect(
        service['handleMessage'](makePayload(JSON.stringify(event), 'iam.events')),
      ).rejects.toThrow('Mongo connection timeout');
    });
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

  // 22/08/2026: bo sung - fix audit "khong co consumer.on(CRASH,...) nao, nen kafkajs het ngan
  // sach retry noi bo se dung han vong lap consumer VINH VIEN, am tham, khong crash tien trinh va
  // khong bi /health phat hien". Gan truc tiep 1 mock consumer vao field private `consumer` (thay
  // vi goi onModuleInit() that, von tao ket noi Kafka that) - mirror cach cac spec khac trong repo
  // nay truy cap member private qua bracket notation (vd service['handleMessage']).
  describe('registerCrashHandler/restartWithBackoff (fix audit "Kafka consumer CRASH khong duoc xu ly")', () => {
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

    // 25/08/2026: fix code review Minor (phat hien qua dot ra soat toan du an lan 3) - truoc ban
    // sua nay, onModuleDestroy() khong huy timer backoff dang cho, nen module bi pha huy DUNG luc
    // dang "ngu" giua 1 lan backoff van tu ket noi lai "ma" sau khi da coi la tat xong.
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
