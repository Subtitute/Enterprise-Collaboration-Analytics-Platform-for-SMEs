import { Column, Entity, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { Organization } from './organization.entity';
import { Department } from './department.entity';
import { Role } from './role.entity';

@Entity('users')
export class User extends AppBaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, (org) => org.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'department_id', nullable: true, type: 'uuid' })
  departmentId?: string | null;

  @ManyToOne(() => Department, (department) => department.users, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'department_id' })
  department?: Department | null;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // 16/09/2026: "Super Admin" (tinh nang moi) - true CHI VOI tai khoan quan tri nen tang, duoc
  // tao boi SuperAdminBootstrapService luc iam-service khoi dong (xem bootstrap/), khong the tu
  // dang ky qua registerOrganization()/invite() (ca 2 KHONG dat truong nay). Mac dinh false cho
  // MOI nguoi dung thuong - khong doi hanh vi cu. organizationId van tro toi 1 to chuc THAT
  // (Organization.isSystem = true, xem organization.entity.ts) de khong pha vo rang buoc FK NOT
  // NULL hien co - Super Admin khong dung endpoint nghiep vu theo to chuc nao ca nen noi dung to
  // chuc "an cu" nay khong quan trong.
  @Column({ name: 'is_super_admin', default: false })
  isSuperAdmin: boolean;

  /** Eager tren 1 chieu duy nhat (User -> Role) de tranh xung dot eager 2 chieu cua TypeORM. */
  @ManyToMany(() => Role, (role) => role.users, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];
}
