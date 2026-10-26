import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * 26/10/2026: read-model phong ban HIEN TAI cua user - Manager xem duoc tai lieu cua du an co
 * thanh vien/nguoi phu trach thuoc phong ban minh, nen can biet phong ban cua NGUOI KHAC (JWT chi
 * mang phong ban cua chinh nguoi goi). Nguon: iam.events (USER_REGISTERED/USER_DEPARTMENT_CHANGED,
 * USER_DELETED) theo kieu gia tri moi nhat thang - cung cach dim_user cua Analytics Service. IAM
 * tu phat lai phong ban cua moi user moi lan khoi dong (UserDepartmentSyncService) nen bang nay
 * tu lanh neu tung bi lech.
 */
@Entity('user_department_refs')
export class UserDepartmentRef {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Index()
  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;
}
