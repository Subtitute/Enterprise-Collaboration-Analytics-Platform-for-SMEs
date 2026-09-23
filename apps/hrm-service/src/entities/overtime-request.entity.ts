import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

/** He so tang ca theo Luat LD VN - WEEKDAY=1.5, WEEKEND=2.0, HOLIDAY=3.0 (xem OvertimeRequestsService.create()). */
export enum OvertimeMultiplierType {
  WEEKDAY = 'WEEKDAY',
  WEEKEND = 'WEEKEND',
  HOLIDAY = 'HOLIDAY',
}

// 22/09/2026: khai bao CUC BO, mirror AttendanceAdjustmentStatus (attendance-adjustment.entity.ts) -
// cung ly do (khong xuat hien trong Kafka payload nao).
export enum OvertimeRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * 22/09/2026: Dang ky/duyet tang ca (OT) - thay the co che gia lap hoan toan bang localStorage o
 * frontend (attendance-extensions.types.ts/OvertimeRegistrationModal.tsx/PendingOvertimeList.tsx)
 * truoc day. Mirror dung pattern LeaveRequest/AttendanceAdjustment (status/approverId/decisionNote/
 * decidedAt). `multiplier` duoc SERVER TU TINH tu `multiplierType` (khong nhan tu client) - tranh
 * client gui sai he so lam sai so gio tinh luong.
 */
@Entity('overtime_requests')
export class OvertimeRequest extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  /** Gio bat dau OT, dang 'HH:mm'. */
  @Column({ name: 'ot_start', type: 'varchar', length: 5 })
  otStart: string;

  /** Gio ket thuc OT, dang 'HH:mm'. */
  @Column({ name: 'ot_end', type: 'varchar', length: 5 })
  otEnd: string;

  @Column({ name: 'multiplier_type', type: 'enum', enum: OvertimeMultiplierType })
  multiplierType: OvertimeMultiplierType;

  @Column({ type: 'double precision' })
  multiplier: number;

  @Column({ name: 'estimated_hours', type: 'double precision' })
  estimatedHours: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: OvertimeRequestStatus, default: OvertimeRequestStatus.PENDING })
  status: OvertimeRequestStatus;

  @Column({ name: 'approver_id', type: 'uuid', nullable: true })
  approverId?: string | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote?: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt?: Date | null;
}
