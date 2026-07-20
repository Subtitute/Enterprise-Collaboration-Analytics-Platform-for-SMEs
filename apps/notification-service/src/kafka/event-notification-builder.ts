import {
  DocumentSharedPayload,
  DomainEvent,
  EVENT_TYPES,
  TaskAssignedPayload,
} from '@app/common-dto';
import { NotificationDraft } from '../notifications/interfaces/notification-draft.interface';

/**
 * Anh xa 1 DomainEvent (tu Kafka) -> 1 NotificationDraft, hoac `null` neu event khong sinh
 * thong bao. Ham THUAN (pure): khong goi DB/gateway, chi tinh toan tu input -> output, de
 * unit test va de mo rong (them event type moi chi can them 1 nhanh trong switch).
 *
 * PHAM VI MVP (gioi han da biet - xem bao cao/README): chi xu ly `task.assigned` va
 * `document.shared`. Cac event khac (task.created, task.status_changed, project.*,
 * document.uploaded, document.deleted, iam.*) CHUA sinh thong bao ca nhan trong MVP nay vi
 * viec xac dinh "ai lien quan den project/document nay" can tra cuu xuyen service (vd. danh
 * sach thanh vien du an o Project-Task Service) - ngoai pham vi cua Notification Service
 * (service nay chi tieu thu event, khong co quyen truy van DB cua service khac - Technical
 * Spec.md muc 1 "database-per-service"). Huong mo rong: Project-Task/Document Service dinh
 * kem san danh sach nguoi lien quan vao payload event, hoac Notification Service goi REST
 * noi bo (qua Gateway) de tra cuu khi can.
 */
export function buildNotificationFromEvent(event: DomainEvent): NotificationDraft | null {
  switch (event.eventType) {
    case EVENT_TYPES.TASK_ASSIGNED: {
      const payload = event.payload as unknown as TaskAssignedPayload;
      if (!payload?.assigneeId) return null;
      return {
        userId: payload.assigneeId,
        type: EVENT_TYPES.TASK_ASSIGNED,
        title: 'Bạn được giao công việc mới',
        message: `Bạn vừa được giao một công việc mới (mã công việc: ${payload.taskId}).`,
        payload: {
          taskId: payload.taskId,
          projectId: payload.projectId,
          actorId: payload.actorId,
        },
      };
    }

    case EVENT_TYPES.DOCUMENT_SHARED: {
      const payload = event.payload as unknown as DocumentSharedPayload;
      if (!payload?.sharedWithUserId) return null;
      return {
        userId: payload.sharedWithUserId,
        type: EVENT_TYPES.DOCUMENT_SHARED,
        title: 'Tài liệu đã được chia sẻ với bạn',
        message: `Một tài liệu vừa được chia sẻ với bạn (mã tài liệu: ${payload.fileId}).`,
        payload: {
          fileId: payload.fileId,
          actorId: payload.actorId,
        },
      };
    }

    default:
      return null;
  }
}
