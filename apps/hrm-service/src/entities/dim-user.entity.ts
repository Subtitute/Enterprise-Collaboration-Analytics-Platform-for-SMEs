import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * 26/10/2026: read-model "user -> phong ban HIEN TAI" (mirror bang dim_user cua Analytics Service/
 * ml-service) - phuc vu pham vi xem/duyet cua Manager: "cham cong/nghi phep/tang ca/giai trinh cua
 * thanh vien phong ban Manager". HRM Service khong duoc doc DB cua IAM Service (database-per-service),
 * nen tu dung bang nay tu topic iam.events (USER_REGISTERED/USER_DEPARTMENT_CHANGED/USER_DELETED - xem
 * src/user-directory). 1 dong/user, ghi de gia tri moi nhat.
 */
@Entity('dim_user')
export class DimUser {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Index()
  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;

  // 04/11/2026: ngay vao lam 'YYYY-MM-DD' theo GMT+7 (tham nien, bang cong); null = chua nhan duoc tu IAM.
  @Column({ name: 'joined_at', type: 'date', nullable: true })
  joinedAt: string | null;

  // 04/11/2026: false = tai khoan da vo hieu hoa ben IAM, khong con bi tinh vang trong ky cong dang mo.
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
