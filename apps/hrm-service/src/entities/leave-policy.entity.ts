import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

/**
 * 22/09/2026: Chinh sach nghi phep theo to chuc (HRM-lite mo rong, theo de xuat cua Tien: "Tính
 * phép theo Luật LĐ VN - 12 ngày/năm + thâm niên - Admin - Tự tăng 1 ngày/5 năm, có config"). 1
 * dong/to chuc (unique organizationId), tu tao voi gia tri mac dinh dung Bo luat Lao dong VN (12
 * ngay/nam) tai lan doc dau tien neu chua co - xem LeavePolicyService.getOrCreate() - khong can
 * seed truoc luc dang ky to chuc (mirror tinh than "lazy default" don gian hon la them 1 buoc vao
 * transaction dang ky to chuc hien co o IAM Service, dich vu KHAC voi hrm-service nay).
 */
@Entity('leave_policies')
export class LeavePolicy extends AppBaseEntity {
  @Index({ unique: true })
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'base_days_per_year', type: 'int', default: 12 })
  baseDaysPerYear: number;

  /** Cu moi N nam tham nien (tinh tu ngay vao lam) duoc cong them 1 ngay phep - mac dinh N=5. */
  @Column({ name: 'seniority_years_per_bonus_day', type: 'int', default: 5 })
  seniorityYearsPerBonusDay: number;
}
