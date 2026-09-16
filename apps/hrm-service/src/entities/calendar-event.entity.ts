import { Column, Entity, Index } from 'typeorm';
import { CalendarEventType } from '@app/common-dto';
import { AppBaseEntity } from '../common/base.entity';

/**
 * 15/09/2026: Lich cong ty (HRM-lite mo rong, theo yeu cau GVHD - xem Technical_Spec.md "Lich cong
 * ty"). Mot muc lich la 1 ngay le/su kien duy nhat, co the keo dai nhieu ngay (vd Tet 5 ngay) qua
 * startDate/endDate - mirror dung kieu du lieu LeaveRequest.startDate/endDate ('date', khong phai
 * 'timestamptz' - muc lich la khai niem theo LICH, khong gan voi 1 thoi khac cu the trong ngay).
 */
@Entity('calendar_events')
export class CalendarEvent extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'enum', enum: CalendarEventType, default: CalendarEventType.EVENT })
  type: CalendarEventType;

  @Index()
  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  // Nguoi tao/quan tri - khong khoa cung nhu userId cua LeaveRequest (khong FK xuyen service/DB).
  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;
}
