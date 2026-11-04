import { Column, Entity, Unique } from 'typeorm';
import { TimesheetSymbol } from '@app/common-dto';
import { AppBaseEntity } from '../common/base.entity';

/**
 * 04/11/2026: dong sua tay tren bang cong - chi luu ngay co sua tay, con lai tinh tu dong (xem
 * timesheet-calculator.ts). 1 dong/nguoi/ngay; mo khoa ky khong xoa cac dong nay.
 */
@Entity('timesheet_entries')
@Unique(['organizationId', 'userId', 'workDate'])
export class TimesheetEntry extends AppBaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @Column({ type: 'enum', enum: TimesheetSymbol })
  symbol: TimesheetSymbol;

  @Column({ type: 'text' })
  note: string;

  @Column({ name: 'updated_by_user_id', type: 'uuid' })
  updatedByUserId: string;
}
