import { Column, Entity, Index, OneToMany } from 'typeorm';
import { ProjectStatus } from '@app/common-dto';
import { AppBaseEntity } from '../common/base.entity';
import { Task } from './task.entity';

/** Du an - Technical_Spec.md muc 3.3, muc 5. */
@Entity('projects')
export class Project extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  status: ProjectStatus;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];
}
