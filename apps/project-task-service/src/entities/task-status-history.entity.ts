import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TaskStatus } from '@app/common-dto';
import { AppBaseEntity } from '../common/base.entity';
import { Task } from './task.entity';

/**
 * Lich su doi trang thai cong viec - Technical_Spec.md muc 3.3 (dieu chinh 21/07/2026).
 * Ghi 1 ban ghi trong CUNG transaction voi Task.status va Outbox (TasksService.updateStatus()),
 * phuc vu modal chi tiet Task hien thi lich su doi trang thai (Wireframe.md muc 4.2).
 */
@Entity('task_status_histories')
export class TaskStatusHistory extends AppBaseEntity {
  @Index()
  @Column({ name: 'task_id' })
  taskId: string;

  @ManyToOne(() => Task, (task) => task.statusHistories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'from_status', type: 'enum', enum: TaskStatus })
  fromStatus: TaskStatus;

  @Column({ name: 'to_status', type: 'enum', enum: TaskStatus })
  toStatus: TaskStatus;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ name: 'changed_at', type: 'timestamptz' })
  changedAt: Date;
}
