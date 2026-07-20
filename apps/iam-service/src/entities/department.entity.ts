import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { Organization } from './organization.entity';
import { User } from './user.entity';

@Entity('departments')
export class Department extends AppBaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, (org) => org.departments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column()
  name: string;

  @OneToMany(() => User, (user) => user.department)
  users: User[];
}
