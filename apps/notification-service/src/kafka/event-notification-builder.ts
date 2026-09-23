import {
  AttendanceAdjustmentApprovedPayload,
  AttendanceAdjustmentRejectedPayload,
  CalendarEventCreatedPayload,
  DealStage,
  DealStageChangedPayload,
  DocumentSharedPayload,
  DomainEvent,
  EVENT_TYPES,
  LeaveRequestApprovedPayload,
  LeaveRequestRejectedPayload,
  OvertimeRequestApprovedPayload,
  OvertimeRequestRejectedPayload,
  TaskAssignedPayload,
  TaskStatus,
  TaskStatusChangedPayload,
} from '@app/common-dto';
import { NotificationDraft } from '../notifications/interfaces/notification-draft.interface';

/**
 * Anh xa 1 DomainEvent (tu Kafka) -> 1 NotificationDraft, hoac `null` neu event khong sinh
 * thong bao. Ham THUAN (pure): khong goi DB/gateway, chi tinh toan tu input -> output, de
 * unit test va de mo rong (them event type moi chi can them 1 nhanh trong switch).
 *
 * PHAM VI MVP (gioi han da biet - xem bao cao/README): chi xu ly `task.assigned` va
 * `document.shared`. Cac event khac (task.created, project.*, document.uploaded,
 * document.deleted, iam.*) CHUA sinh thong bao ca nhan trong MVP nay vi viec xac dinh "ai lien
 * quan den project/document nay" can tra cuu xuyen service (vd. danh sach thanh vien du an o
 * Project-Task Service) - ngoai pham vi cua Notification Service (service nay chi tieu thu
 * event, khong co quyen truy van DB cua service khac - Technical Spec.md muc 1
 * "database-per-service"). Huong mo rong: Project-Task/Document Service dinh kem san danh sach
 * nguoi lien quan vao payload event, hoac Notification Service goi REST noi bo (qua Gateway) de
 * tra cuu khi can.
 *
 * 22/09/2026: `task.status_changed` la vi du dau tien ap dung huong mo rong tren - Project-Task
 * Service (TasksService.updateStatus()) da dinh kem san `leadUserId` vao payload tai thoi diem
 * phat event, nen o day chi can doc lai `payload.leadUserId`, khong can tra cuu gi them.
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

    // 04/08/2026: CRM-lite (Technical_Spec.md muc 16) - chi sinh thong bao khi deal CHOT THANH
    // CONG (chuyen sang WON), khong sinh thong bao cho moi lan doi giai doan (qua nhieu, khong
    // huu ich). Thong bao cho chinh nguoi thuc hien thao tac (actorId) thay vi mo rong payload
    // them ownerUserId rieng - dua tren gia dinh hop ly: nguoi co quyen doi giai doan deal
    // (PERMISSIONS.DEAL_UPDATE) chinh la nguoi phu trach ban hang cho deal do.
    case EVENT_TYPES.DEAL_STAGE_CHANGED: {
      const payload = event.payload as unknown as DealStageChangedPayload;
      if (payload?.toStage !== DealStage.WON || !payload.actorId) return null;
      return {
        userId: payload.actorId,
        type: EVENT_TYPES.DEAL_STAGE_CHANGED,
        title: 'Deal đã chốt thành công',
        message: `Chúc mừng! Một cơ hội bán hàng vừa được đánh dấu thắng (mã deal: ${payload.dealId}).`,
        payload: {
          dealId: payload.dealId,
          customerId: payload.customerId,
          actorId: payload.actorId,
        },
      };
    }

    // 05/08/2026: HRM-lite (Technical_Spec.md muc 17) - chi sinh thong bao cho 2 su kien QUYET
    // DINH cua nghi phep (nguoi nhan ro rang: nguoi xin nghi), mirror ly do bo qua DEAL_CREATED o
    // CRM-lite (LEAVE_REQUEST_CREATED khong co "nguoi duyet" cu the ngay luc tao - moi Manager/Org
    // Admin deu duyet duoc - Notification Service khong co cach tra cuu "tat ca Manager cua to
    // chuc nay" ma khong goi HTTP noi bo, hien chua ton tai ha tang do). Khong sinh thong bao cho
    // ATTENDANCE_CHECKED_IN/OUT - hanh dong tu than, nguoi dung da biet minh vua lam gi.
    case EVENT_TYPES.LEAVE_REQUEST_APPROVED: {
      const payload = event.payload as unknown as LeaveRequestApprovedPayload;
      if (!payload?.userId) return null;
      return {
        userId: payload.userId,
        type: EVENT_TYPES.LEAVE_REQUEST_APPROVED,
        title: 'Yêu cầu nghỉ phép đã được duyệt',
        message: `Yêu cầu nghỉ phép của bạn đã được duyệt (mã yêu cầu: ${payload.leaveRequestId}).`,
        payload: {
          leaveRequestId: payload.leaveRequestId,
          actorId: payload.actorId,
        },
      };
    }

    case EVENT_TYPES.LEAVE_REQUEST_REJECTED: {
      const payload = event.payload as unknown as LeaveRequestRejectedPayload;
      if (!payload?.userId) return null;
      return {
        userId: payload.userId,
        type: EVENT_TYPES.LEAVE_REQUEST_REJECTED,
        title: 'Yêu cầu nghỉ phép đã bị từ chối',
        message: `Yêu cầu nghỉ phép của bạn đã bị từ chối (mã yêu cầu: ${payload.leaveRequestId}).`,
        payload: {
          leaveRequestId: payload.leaveRequestId,
          actorId: payload.actorId,
        },
      };
    }

    // 22/09/2026: giai trinh/duyet cham cong va tang ca (HRM-lite mo rong) - mirror CHINH XAC 2
    // nhanh LEAVE_REQUEST_APPROVED/REJECTED o tren (cung hinh dang payload: userId nguoi gui yeu
    // cau, actorId nguoi duyet).
    case EVENT_TYPES.ATTENDANCE_ADJUSTMENT_APPROVED: {
      const payload = event.payload as unknown as AttendanceAdjustmentApprovedPayload;
      if (!payload?.userId) return null;
      return {
        userId: payload.userId,
        type: EVENT_TYPES.ATTENDANCE_ADJUSTMENT_APPROVED,
        title: 'Yêu cầu giải trình chấm công đã được duyệt',
        message: `Yêu cầu giải trình chấm công của bạn đã được duyệt (mã yêu cầu: ${payload.attendanceAdjustmentId}).`,
        payload: {
          attendanceAdjustmentId: payload.attendanceAdjustmentId,
          actorId: payload.actorId,
        },
      };
    }

    case EVENT_TYPES.ATTENDANCE_ADJUSTMENT_REJECTED: {
      const payload = event.payload as unknown as AttendanceAdjustmentRejectedPayload;
      if (!payload?.userId) return null;
      return {
        userId: payload.userId,
        type: EVENT_TYPES.ATTENDANCE_ADJUSTMENT_REJECTED,
        title: 'Yêu cầu giải trình chấm công đã bị từ chối',
        message: `Yêu cầu giải trình chấm công của bạn đã bị từ chối (mã yêu cầu: ${payload.attendanceAdjustmentId}).`,
        payload: {
          attendanceAdjustmentId: payload.attendanceAdjustmentId,
          actorId: payload.actorId,
        },
      };
    }

    case EVENT_TYPES.OVERTIME_REQUEST_APPROVED: {
      const payload = event.payload as unknown as OvertimeRequestApprovedPayload;
      if (!payload?.userId) return null;
      return {
        userId: payload.userId,
        type: EVENT_TYPES.OVERTIME_REQUEST_APPROVED,
        title: 'Yêu cầu tăng ca đã được duyệt',
        message: `Yêu cầu tăng ca của bạn đã được duyệt (mã yêu cầu: ${payload.overtimeRequestId}).`,
        payload: {
          overtimeRequestId: payload.overtimeRequestId,
          actorId: payload.actorId,
        },
      };
    }

    case EVENT_TYPES.OVERTIME_REQUEST_REJECTED: {
      const payload = event.payload as unknown as OvertimeRequestRejectedPayload;
      if (!payload?.userId) return null;
      return {
        userId: payload.userId,
        type: EVENT_TYPES.OVERTIME_REQUEST_REJECTED,
        title: 'Yêu cầu tăng ca đã bị từ chối',
        message: `Yêu cầu tăng ca của bạn đã bị từ chối (mã yêu cầu: ${payload.overtimeRequestId}).`,
        payload: {
          overtimeRequestId: payload.overtimeRequestId,
          actorId: payload.actorId,
        },
      };
    }

    // 22/09/2026: thong bao cho nguoi phu trach du an (leadUserId) khi 1 Task chuyen sang DONE -
    // chi xu ly khi toStatus === TaskStatus.DONE (mirror DEAL_STAGE_CHANGED o tren, khong thong
    // bao MOI lan doi trang thai). leadUserId duoc dinh kem san trong payload boi
    // TasksService.updateStatus() (Project-Task Service) tai thoi diem phat event - xem chu thich
    // dau file.
    case EVENT_TYPES.TASK_STATUS_CHANGED: {
      const payload = event.payload as unknown as TaskStatusChangedPayload;
      // 22/09/2026: chan tu gui thong bao cho chinh minh neu nguoi hoan thanh Task CUNG LA nguoi
      // phu trach du an - mirror dung hanh vi cua ban gia lap localStorage truoc day
      // (notifyTaskCompleted(), da xoa khoi apps/web/src/features/projects/utils.ts) de tranh
      // "Notification Fatigue" (Manager tu lam viec khong can duoc bao chinh minh vua lam gi).
      if (payload?.toStatus !== TaskStatus.DONE || !payload.leadUserId || payload.leadUserId === payload.actorId) return null;
      return {
        userId: payload.leadUserId,
        type: EVENT_TYPES.TASK_STATUS_CHANGED,
        title: 'Công việc đã hoàn thành',
        message: `Một công việc trong dự án bạn phụ trách vừa được đánh dấu hoàn thành (mã công việc: ${payload.taskId}).`,
        payload: {
          taskId: payload.taskId,
          projectId: payload.projectId,
          actorId: payload.actorId,
        },
      };
    }

    default:
      return null;
  }
}

/**
 * 17/09/2026: mot so event can THONG BAO CHO TOAN BO thanh vien to chuc (khac moi case tren, luon
 * co DUNG 1 nguoi nhan xac dinh tu payload) - vd Org Admin cong bo 1 ngay nghi le cong ty. Ham nay
 * tra ve 1 "mau" (thieu san `userId`) - KafkaConsumerService.handleMessage() se dien `userId` cho
 * TUNG thanh vien active (tra cuu qua OrgMembersService) khi fan-out, mirror pattern
 * buildNotificationFromEvent() (1 ham thuan, khong goi DB/gateway) nhung tach rieng vi hinh dang
 * ket qua khac han (thieu userId, co the sinh ra NHIEU notification tu 1 event thay vi toi da 1).
 *
 * CHI xu ly CalendarEventType.HOLIDAY - loai EVENT (hop/su kien thong thuong) khong dang de thong
 * bao toan to chuc, chi can hien tren Lich cong ty (Org Admin) la du (dung `string` cho `type`
 * giong CalendarEventCreatedPayload, tranh vong lap phu thuoc - xem chu thich tai payload do).
 */
export function buildBroadcastNotificationTemplate(event: DomainEvent): Omit<NotificationDraft, 'userId'> | null {
  switch (event.eventType) {
    case EVENT_TYPES.CALENDAR_EVENT_CREATED: {
      const payload = event.payload as unknown as CalendarEventCreatedPayload;
      if (payload?.type !== 'HOLIDAY') return null;
      return {
        type: EVENT_TYPES.CALENDAR_EVENT_CREATED,
        title: 'Thông báo ngày nghỉ lễ công ty',
        message: `Tổ chức của bạn vừa công bố ngày nghỉ lễ "${payload.title}" (từ ${payload.startDate} đến ${payload.endDate}). Bạn sẽ không thể chấm công vào (các) ngày này.`,
        payload: {
          calendarEventId: payload.calendarEventId,
          startDate: payload.startDate,
          endDate: payload.endDate,
          actorId: payload.actorId,
        },
      };
    }

    default:
      return null;
  }
}
