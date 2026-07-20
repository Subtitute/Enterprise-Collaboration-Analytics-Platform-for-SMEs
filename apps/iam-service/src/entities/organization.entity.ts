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

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Department, (department) => department.organization)
  departments: Department[];

  @OneToMany(() => Role, (role) => role.organization)
  roles: Role[];
}
