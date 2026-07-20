import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { TaskStatus } from '@app/common-dto';
import { AppBaseEntity } from '../common/base.entity';
import { Project } from './project.entity';
import { TaskAssignee } from './task-assignee.entity';
import { TaskComment } from './task-comment.entity';

/** Cong viec (Kanban) - Technical_Spec.md muc 3.3, Wireframe.md muc 4.2. */
@Entity('tasks')
export class Task extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Index()
  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status: TaskStatus;

  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate?: Date | null;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @OneToMany(() => TaskAssignee, (assignee) => assignee.task)
  assignees: TaskAssignee[];

  @OneToMany(() => TaskComment, (comment) => comment.task)
  comments: TaskComment[];
}
