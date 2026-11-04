import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

/**
 * 04/11/2026: dieu chinh so phep cua 1 nhan vien trong 1 nam (phep ton chuyen sang, thuong phep, tru
 * phep...). Chi them moi, khong sua/xoa - muon dinh chinh thi them 1 dong nguoc dau de con lai vet.
 */
@Entity('leave_balance_adjustments')
@Index(['organizationId', 'userId', 'year'])
export class LeaveBalanceAdjustment extends AppBaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  year: number;

  /** Khac 0, am duoc. */
  @Column({ type: 'int' })
  days: number;

  @Column({ type: 'text' })
  note: string;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;
}
