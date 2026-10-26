import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Task } from '../entities/task.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
// 26/10/2026: anh chup thanh vien du an cho Document Service backfill (tai lieu theo pham vi du an).
import { ProjectMembershipSnapshotService } from './project-membership-snapshot.service';
import { InternalProjectMembershipsController } from './internal-project-memberships.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Task, TaskAssignee]), OutboxModule],
  providers: [ProjectsService, ProjectMembershipSnapshotService],
  controllers: [ProjectsController, InternalProjectMembershipsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
