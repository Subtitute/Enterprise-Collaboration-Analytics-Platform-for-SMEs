import { DealStage, DomainEvent, EVENT_TYPES } from '@app/common-dto';
import { buildBroadcastNotificationTemplate, buildNotificationFromEvent } from './event-notification-builder';

/**
 * Unit test cho ham anh xa event -> notification - Technical_Spec.md muc 10
 * ("Unit test: logic nghiep vu cot loi moi service").
 */
describe('buildNotificationFromEvent', () => {
  it('sinh notification cho user duoc giao viec khi nhan "task.assigned"', () => {
    const event: DomainEvent = {
      eventId: 'evt-1',
      eventType: EVENT_TYPES.TASK_ASSIGNED,
      occurredAt: '2026-07-18T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'project-task-service',
      payload: {
        taskId: 'task-1',
        projectId: 'project-1',
        assigneeId: 'user-assignee',
        actorId: 'user-actor',
      },
    };

    const draft = buildNotificationFromEvent(event);

    expect(draft).not.toBeNull();
    expect(draft?.userId).toBe('user-assignee');
    expect(draft?.type).toBe(EVENT_TYPES.TASK_ASSIGNED);
    expect(draft?.title).toBe('Bạn được giao công việc mới');
    expect(draft?.message).toContain('task-1');
    expect(draft?.payload).toEqual({
      taskId: 'task-1',
      projectId: 'project-1',
      actorId: 'user-actor',
    });
  });

  it('sinh notification cho user duoc chia se tai lieu khi nhan "document.shared"', () => {
    const event: DomainEvent = {
      eventId: 'evt-2',
      eventType: EVENT_TYPES.DOCUMENT_SHARED,
      occurredAt: '2026-07-18T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'document-service',
      payload: {
        fileId: 'file-1',
        sharedWithUserId: 'user-recipient',
        actorId: 'user-actor',
      },
    };

    const draft = buildNotificationFromEvent(event);

    expect(draft).not.toBeNull();
    expect(draft?.userId).toBe('user-recipient');
    expect(draft?.type).toBe(EVENT_TYPES.DOCUMENT_SHARED);
    expect(draft?.title).toBe('Tài liệu đã được chia sẻ với bạn');
    expect(draft?.message).toContain('file-1');
    expect(draft?.payload).toEqual({ fileId: 'file-1', actorId: 'user-actor' });
  });

  it('tra ve null cho cac event type khong duoc ho tro (vd. task.status_changed)', () => {
    const event: DomainEvent = {
      eventId: 'evt-3',
      eventType: EVENT_TYPES.TASK_STATUS_CHANGED,
      occurredAt: '2026-07-18T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'project-task-service',
      payload: {
        taskId: 'task-1',
        projectId: 'project-1',
        fromStatus: 'DOING',
        toStatus: 'DONE',
        actorId: 'user-actor',
      },
    };

    expect(buildNotificationFromEvent(event)).toBeNull();
  });

  it('tra ve null cho eventType hoan toan khong xac dinh', () => {
    const event: DomainEvent = {
      eventId: 'evt-4',
      eventType: 'unknown.event.type',
      occurredAt: '2026-07-18T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'unknown-service',
      payload: {},
    };

    expect(buildNotificationFromEvent(event)).toBeNull();
  });

  it('tra ve null neu payload thieu truong bat buoc (assigneeId rong)', () => {
    const event: DomainEvent = {
      eventId: 'evt-5',
      eventType: EVENT_TYPES.TASK_ASSIGNED,
      occurredAt: '2026-07-18T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'project-task-service',
      payload: { taskId: 'task-1', projectId: 'project-1', actorId: 'user-actor' },
    };

    expect(buildNotificationFromEvent(event)).toBeNull();
  });

  // 29/08/2026: bo sung - 3 nhanh CRM-lite/HRM-lite (deal.stage_changed, leave_request.approved,
  // leave_request.rejected, them tu 04-05/08/2026) chua tung co test nao, keo branch coverage
  // toan file xuong con 30.76% - la nguyen nhan chinh khien coverageThreshold "branches" (55%)
  // cua notification-service khong dat (thuc te 49.57%) va lam that bai buoc "Unit tests" tren CI
  // (Technical_Spec.md muc 11) du moi assertion hien co van pass. Bo sung du cac nhanh con thieu.
  it('sinh notification khi deal CHOT THANG (toStage=WON, co actorId)', () => {
    const event: DomainEvent = {
      eventId: 'evt-6',
      eventType: EVENT_TYPES.DEAL_STAGE_CHANGED,
      occurredAt: '2026-08-04T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'crm-service',
      payload: {
        dealId: 'deal-1',
        customerId: 'customer-1',
        fromStage: DealStage.NEGOTIATION,
        toStage: DealStage.WON,
        actorId: 'user-actor',
      },
    };

    const draft = buildNotificationFromEvent(event);

    expect(draft).not.toBeNull();
    expect(draft?.userId).toBe('user-actor');
    expect(draft?.type).toBe(EVENT_TYPES.DEAL_STAGE_CHANGED);
    expect(draft?.message).toContain('deal-1');
    expect(draft?.payload).toEqual({ dealId: 'deal-1', customerId: 'customer-1', actorId: 'user-actor' });
  });

  it('tra ve null khi deal doi giai doan nhung KHONG PHAI chot thang (vd toStage=PROPOSAL)', () => {
    const event: DomainEvent = {
      eventId: 'evt-7',
      eventType: EVENT_TYPES.DEAL_STAGE_CHANGED,
      occurredAt: '2026-08-04T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'crm-service',
      payload: {
        dealId: 'deal-1',
        customerId: 'customer-1',
        fromStage: DealStage.CONTACTED,
        toStage: DealStage.PROPOSAL,
        actorId: 'user-actor',
      },
    };

    expect(buildNotificationFromEvent(event)).toBeNull();
  });

  it('tra ve null neu payload deal.stage_changed thieu actorId du toStage=WON', () => {
    const event: DomainEvent = {
      eventId: 'evt-8',
      eventType: EVENT_TYPES.DEAL_STAGE_CHANGED,
      occurredAt: '2026-08-04T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'crm-service',
      payload: { dealId: 'deal-1', customerId: 'customer-1', fromStage: DealStage.NEGOTIATION, toStage: DealStage.WON },
    };

    expect(buildNotificationFromEvent(event)).toBeNull();
  });

  it('sinh notification cho nguoi xin nghi khi yeu cau nghi phep duoc DUYET', () => {
    const event: DomainEvent = {
      eventId: 'evt-9',
      eventType: EVENT_TYPES.LEAVE_REQUEST_APPROVED,
      occurredAt: '2026-08-05T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'hrm-service',
      payload: { leaveRequestId: 'leave-1', userId: 'user-requester', actorId: 'user-manager' },
    };

    const draft = buildNotificationFromEvent(event);

    expect(draft).not.toBeNull();
    expect(draft?.userId).toBe('user-requester');
    expect(draft?.type).toBe(EVENT_TYPES.LEAVE_REQUEST_APPROVED);
    expect(draft?.message).toContain('leave-1');
    expect(draft?.payload).toEqual({ leaveRequestId: 'leave-1', actorId: 'user-manager' });
  });

  it('tra ve null neu payload leave_request.approved thieu userId', () => {
    const event: DomainEvent = {
      eventId: 'evt-10',
      eventType: EVENT_TYPES.LEAVE_REQUEST_APPROVED,
      occurredAt: '2026-08-05T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'hrm-service',
      payload: { leaveRequestId: 'leave-1', actorId: 'user-manager' },
    };

    expect(buildNotificationFromEvent(event)).toBeNull();
  });

  it('sinh notification cho nguoi xin nghi khi yeu cau nghi phep bi TU CHOI', () => {
    const event: DomainEvent = {
      eventId: 'evt-11',
      eventType: EVENT_TYPES.LEAVE_REQUEST_REJECTED,
      occurredAt: '2026-08-05T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'hrm-service',
      payload: { leaveRequestId: 'leave-1', userId: 'user-requester', actorId: 'user-manager' },
    };

    const draft = buildNotificationFromEvent(event);

    expect(draft).not.toBeNull();
    expect(draft?.userId).toBe('user-requester');
    expect(draft?.type).toBe(EVENT_TYPES.LEAVE_REQUEST_REJECTED);
    expect(draft?.message).toContain('leave-1');
    expect(draft?.payload).toEqual({ leaveRequestId: 'leave-1', actorId: 'user-manager' });
  });

  it('tra ve null neu payload leave_request.rejected thieu userId', () => {
    const event: DomainEvent = {
      eventId: 'evt-12',
      eventType: EVENT_TYPES.LEAVE_REQUEST_REJECTED,
      occurredAt: '2026-08-05T09:30:00.000Z',
      organizationId: 'org-1',
      producer: 'hrm-service',
      payload: { leaveRequestId: 'leave-1', actorId: 'user-manager' },
    };

    expect(buildNotificationFromEvent(event)).toBeNull();
  });
});

// 17/09/2026: bo sung - thong bao toan to chuc (vd cong bo ngay nghi le cong ty).
describe('buildBroadcastNotificationTemplate', () => {
  it('sinh mau thong bao (thieu userId) khi calendar_event.created co type=HOLIDAY', () => {
    const event: DomainEvent = {
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

    const template = buildBroadcastNotificationTemplate(event);

    expect(template).not.toBeNull();
    expect(template).not.toHaveProperty('userId');
    expect(template?.type).toBe(EVENT_TYPES.CALENDAR_EVENT_CREATED);
    expect(template?.message).toContain('Tet Nguyen Dan');
    expect(template?.payload).toEqual({
      calendarEventId: 'cal-1',
      startDate: '2027-02-05',
      endDate: '2027-02-09',
      actorId: 'admin-1',
    });
  });

  it('tra ve null khi calendar_event.created co type=EVENT (khong phai HOLIDAY)', () => {
    const event: DomainEvent = {
      eventId: 'evt-event-1',
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

    expect(buildBroadcastNotificationTemplate(event)).toBeNull();
  });

  it('tra ve null cho cac eventType khac (khong can thong bao toan to chuc)', () => {
    const event: DomainEvent = {
      eventId: 'evt-task-1',
      eventType: EVENT_TYPES.TASK_ASSIGNED,
      occurredAt: '2026-09-17T09:00:00.000Z',
      organizationId: 'org-1',
      producer: 'project-task-service',
      payload: { taskId: 'task-1', projectId: 'project-1', assigneeId: 'user-1', actorId: 'user-2' },
    };

    expect(buildBroadcastNotificationTemplate(event)).toBeNull();
  });
});
