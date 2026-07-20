import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { Task } from './task.entity';

/** Nguoi duoc giao cong viec - Technical_Spec.md muc 3.3. Unique (taskId, userId) de idempotent khi giao lai. */
@Entity('task_assignees')
@Unique(['taskId', 'userId'])
export class TaskAssignee extends AppBaseEntity {
  @Column({ name: 'task_id' })
  taskId: string;

  @ManyToOne(() => Task, (task) => task.assignees, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;
}
