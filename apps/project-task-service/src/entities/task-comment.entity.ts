import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { Task } from './task.entity';

/** Binh luan tren cong viec - Technical_Spec.md muc 3.3. Khong phat Kafka event (ngoai analytics pipeline). */
@Entity('task_comments')
export class TaskComment extends AppBaseEntity {
  @Index()
  @Column({ name: 'task_id' })
  taskId: string;

  @ManyToOne(() => Task, (task) => task.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Column({ name: 'author_user_id', type: 'uuid' })
  authorUserId: string;

  @Column({ type: 'text' })
  content: string;
}
