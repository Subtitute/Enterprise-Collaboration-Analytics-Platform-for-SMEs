import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * 26/10/2026: read-model "user -> phong ban HIEN TAI" (mirror bang dim_user cua Analytics Service/
 * ml-service) - phuc vu pham vi xem cua Manager: "du an co it nhat 1 thanh vien/lead thuoc phong ban
 * cua Manager". Project-Task Service khong duoc doc DB cua IAM Service (database-per-service), nen tu
 * dung bang nay tu topic iam.events (USER_REGISTERED/USER_DEPARTMENT_CHANGED/USER_DELETED - xem
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

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
