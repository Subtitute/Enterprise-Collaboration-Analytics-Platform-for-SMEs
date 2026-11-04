import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

export type TimesheetPeriodStatus = 'OPEN' | 'LOCKED';

/**
 * 04/11/2026: trang thai ky cong theo thang. Chua co dong nghia la OPEN - chi tao dong khi khoa lan dau.
 * PeriodLockService doc bang nay de chan cac thao tac cham vao thang da khoa; `snapshot` luu ket qua tinh
 * toan to chuc luc khoa.
 */
@Entity('timesheet_periods')
@Index(['organizationId', 'year', 'month'], { unique: true })
export class TimesheetPeriod extends AppBaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'int' })
  year: number;

  /** 1-12. */
  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'varchar', length: 10, default: 'OPEN' })
  status: TimesheetPeriodStatus;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt?: Date | null;

  @Column({ name: 'locked_by_user_id', type: 'uuid', nullable: true })
  lockedByUserId?: string | null;

  @Column({ name: 'unlocked_at', type: 'timestamptz', nullable: true })
  unlockedAt?: Date | null;

  @Column({ name: 'unlocked_by_user_id', type: 'uuid', nullable: true })
  unlockedByUserId?: string | null;

  @Column({ name: 'unlock_reason', type: 'text', nullable: true })
  unlockReason?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  snapshot?: unknown;
}
