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

  // 22/07/2026 (fix code review, loi MINOR - Fix 8): cot moi. Truoc do frontend (NewProjectModal.tsx)
  // da thu gui `dueDate` khi tao du an va doc `project.dueDate` de hien badge han hoan thanh
  // (ProjectCard.tsx/ProjectDetailPage.tsx), nhung entity khong co cot nay -> ValidationPipe
  // (whitelist: true) am tham strip field nay khoi body truoc khi cham toi service, badge luon rong.
  // synchronize: true (app.module.ts) nen cot nay tu tao khi service restart, khong can migration thu cong.
  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate?: Date | null;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  status: ProjectStatus;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];
}
