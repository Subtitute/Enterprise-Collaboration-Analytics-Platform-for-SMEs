import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

/**
 * 04/11/2026: lich lam viec theo to chuc. 1 dong/to chuc, tu tao voi gia tri mac dinh o lan doc dau tien
 * (mirror LeavePolicy) - xem WorkCalendarService.getOrCreateSchedule(). Gio luu dang chuoi 'HH:mm' theo
 * GMT+7 vi la khai niem theo lich, khong gan voi 1 thoi khac cu the.
 */
@Entity('work_schedules')
export class WorkSchedule extends AppBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'organization_id' })
  organizationId: string;

  /** Ngay lam viec trong tuan, 0 = Chu nhat ... 6 = Thu 7. */
  @Column({ name: 'working_weekdays', type: 'smallint', array: true, default: [1, 2, 3, 4, 5] })
  workingWeekdays: number[];

  @Column({ name: 'work_start', type: 'varchar', length: 5, default: '08:30' })
  workStart: string;

  @Column({ name: 'work_end', type: 'varchar', length: 5, default: '17:30' })
  workEnd: string;

  @Column({ name: 'late_grace_minutes', type: 'int', default: 0 })
  lateGraceMinutes: number;

  @Column({ name: 'early_leave_grace_minutes', type: 'int', default: 0 })
  earlyLeaveGraceMinutes: number;

  @Column({ name: 'break_minutes', type: 'int', default: 60 })
  breakMinutes: number;
}
