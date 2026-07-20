import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../entities/task.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { TaskComment } from '../entities/task-comment.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskAssignee, TaskComment]), OutboxModule],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
