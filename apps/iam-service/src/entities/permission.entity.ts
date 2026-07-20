import { Column, Entity, ManyToMany } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { Role } from './role.entity';

/** Permission la du lieu TOAN CUC (khong theo tung org) - duoc seed tu packages/common-dto PERMISSIONS. */
@Entity('permissions')
export class Permission extends AppBaseEntity {
  @Column({ unique: true })
  key: string;

  @Column({ nullable: true })
  description?: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];
}
