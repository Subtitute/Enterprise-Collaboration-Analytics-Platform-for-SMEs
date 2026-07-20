import { DomainEvent, EVENT_TYPES } from '@app/common-dto';
import { buildNotificationFromEvent } from './event-notification-builder';

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
});
