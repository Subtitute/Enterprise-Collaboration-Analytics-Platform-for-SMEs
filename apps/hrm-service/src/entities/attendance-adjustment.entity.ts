import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

// 22/09/2026: khai bao CUC BO trong entity nay (khong dua vao packages/common-dto/enums), mirror
// ProjectPriority (apps/project-task-service/src/entities/project.entity.ts) - status nay chi dung
// noi bo trong hrm-service, khong xuat hien trong Kafka payload nao (xem AttendanceAdjustmentApproved/
// RejectedPayload, packages/common-dto/src/events/event-envelope.ts - chi mang id/userId/actorId).
export enum AttendanceAdjustmentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * 22/09/2026: Giai trinh/duyet cham cong - thay the co che gia lap hoan toan bang localStorage o
 * frontend (attendance-extensions.types.ts/AttendanceAdjustmentModal.tsx/PendingAdjustmentsList.tsx)
 * truoc day, khong luu server-side, khong dong bo giua trinh duyet/thiet bi, khong co audit that.
 * Mirror dung pattern LeaveRequest (entities/leave-request.entity.ts): status/approverId/
 * decisionNote/decidedAt la "review metadata" chuan cua service nay.
 *
 * `originalCheckInAt`/`originalCheckOutAt` la BAN CHUP (snapshot) gio cham cong tai THOI DIEM gui
 * yeu cau - khong doc lai truc tiep tu Attendance luc hien thi, giu dung ngu canh "yeu cau nay dua
 * tren trang thai nao" ke ca khi Attendance bi 1 yeu cau KHAC (da duyet truoc do) thay doi giua
 * luc.
 */
@Entity('attendance_adjustments')
export class AttendanceAdjustment extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'attendance_id', type: 'uuid' })
  attendanceId: string;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @Column({ name: 'original_check_in_at', type: 'timestamptz', nullable: true })
  originalCheckInAt?: Date | null;

  @Column({ name: 'original_check_out_at', type: 'timestamptz', nullable: true })
  originalCheckOutAt?: Date | null;

  @Column({ name: 'proposed_check_in_at', type: 'timestamptz' })
  proposedCheckInAt: Date;

  @Column({ name: 'proposed_check_out_at', type: 'timestamptz' })
  proposedCheckOutAt: Date;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: AttendanceAdjustmentStatus, default: AttendanceAdjustmentStatus.PENDING })
  status: AttendanceAdjustmentStatus;

  @Column({ name: 'approver_id', type: 'uuid', nullable: true })
  approverId?: string | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote?: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt?: Date | null;
}
