import { Column, Entity, Index } from 'typeorm';
import { LeaveRequestStatus } from '@app/common-dto';
import { AppBaseEntity } from '../common/base.entity';

/** Yeu cau nghi phep - Technical_Spec.md muc 17, Wireframe.md muc 13. */
@Entity('leave_requests')
export class LeaveRequest extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: LeaveRequestStatus, default: LeaveRequestStatus.PENDING })
  status: LeaveRequestStatus;

  @Column({ name: 'approver_id', type: 'uuid', nullable: true })
  approverId?: string | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote?: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt?: Date | null;
}
