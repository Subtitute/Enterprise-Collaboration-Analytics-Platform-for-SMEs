import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 26/10/2026: nhat ky sua ho so (Technical_Spec.md muc 27.4) - CHI ghi ten truong da doi (vd
 * ['phoneNumber', 'avatar']), KHONG BAO GIO ghi gia tri. Giu 1 nam (xoa trong job hang ngay cua
 * UsersService). Mirror tinh than RolePermissionChangeLog nhung khong co FK de nhat ky con lai
 * sau khi tai khoan bi xoa vinh vien.
 */
@Entity('user_profile_change_logs')
@Index(['organizationId', 'targetUserId'])
export class UserProfileChangeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'target_user_id', type: 'uuid' })
  targetUserId: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ name: 'changed_fields', type: 'text', array: true })
  changedFields: string[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
