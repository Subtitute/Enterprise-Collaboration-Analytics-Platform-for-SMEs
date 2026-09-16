import { Column, Entity, OneToMany } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { User } from './user.entity';
import { Department } from './department.entity';
import { Role } from './role.entity';

/** Tenant cua nen tang multi-tenant - Technical_Spec.md muc 1 va muc 5. */
@Entity('organizations')
export class Organization extends AppBaseEntity {
  @Column()
  name: string;

  @Column({ name: 'tax_code', nullable: true })
  taxCode?: string;

  // 16/09/2026: "Super Admin" (tinh nang moi) - cho phep Super Admin khoa toan bo 1 to chuc (moi
  // user thuoc to chuc do bi tu choi dang nhap/refresh, xem AuthService.login()/refresh()), mirror
  // dung y tuong User.isActive nhung o cap to chuc thay vi tung nguoi dung rieng le.
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // 16/09/2026: "Super Admin" - danh dau to chuc "he thong" DUY NHAT dung de "an cu" tai khoan
  // Super Admin (xem SuperAdminBootstrapService) - KHONG phai 1 khach hang/tenant nghiep vu that,
  // nen bi loc khoi moi danh sach to chuc ma PlatformAdminService tra ve (khong quan ly duoc qua
  // API nay, tranh Super Admin vo tinh tu khoa chinh to chuc cua minh).
  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Department, (department) => department.organization)
  departments: Department[];

  @OneToMany(() => Role, (role) => role.organization)
  roles: Role[];
}
