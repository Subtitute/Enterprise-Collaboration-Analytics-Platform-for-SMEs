import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import {
  EVENT_TYPES,
  PaginatedResponse,
  PaginationQueryDto,
  TaskAssignedPayload,
  TaskCreatedPayload,
  TaskStatus,
  TaskStatusChangedPayload,
  paginate,
} from '@app/common-dto';
import { Task } from '../entities/task.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { TaskComment } from '../entities/task-comment.entity';
import { OutboxService } from '../outbox/outbox.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { isValidTaskStatusTransition } from './task-status.util';

const PRODUCER = 'project-task-service';

export interface TaskDetail extends Task {
  assigneeIds: string[];
  commentCount: number;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(TaskAssignee) private readonly assigneeRepo: Repository<TaskAssignee>,
    @InjectRepository(TaskComment) private readonly commentRepo: Repository<TaskComment>,
    private readonly outboxService: OutboxService,
  ) {}

  async findAll(organizationId: string, query: TaskQueryDto): Promise<PaginatedResponse<Task>> {
    const where: FindOptionsWhere<Task> = { organizationId };
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;

    const [data, total] = await this.taskRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  async findById(organizationId: string, id: string): Promise<TaskDetail> {
    const task = await this.findTaskOrFail(organizationId, id);

    const [assignees, commentCount] = await Promise.all([
      this.assigneeRepo.find({ where: { taskId: id } }),
      this.commentRepo.count({ where: { taskId: id } }),
    ]);

    return { ...task, assigneeIds: assignees.map((a) => a.userId), commentCount };
  }

  async create(organizationId: string, actorId: string, dto: CreateTaskDto): Promise<Task> {
    return this.dataSource.transaction(async (manager) => {
      const task = await manager.save(
        manager.create(Task, {
          organizationId,
          projectId: dto.projectId,
          title: dto.title,
          description: dto.description ?? null,
          status: TaskStatus.TODO,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          createdByUserId: actorId,
        }),
      );

      const payload: TaskCreatedPayload = {
        taskId: task.id,
        projectId: task.projectId,
        title: task.title,
        actorId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.TASK_CREATED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return task;
    });
  }

  async update(organizationId: string, id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findTaskOrFail(organizationId, id);

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    return this.taskRepo.save(task);
  }

  /**
   * Endpoint keo-tha Kanban board (Wireframe.md muc 4.2). Validate theo TASK_STATUS_TRANSITIONS
   * roi phat EVENT_TYPES.TASK_STATUS_CHANGED qua Outbox trong CUNG transaction voi thay doi status.
   */
  async updateStatus(
    organizationId: string,
    id: string,
    actorId: string,
    dto: UpdateTaskStatusDto,
  ): Promise<Task> {
    const existing = await this.findTaskOrFail(organizationId, id);

    const fromStatus = existing.status;
    const toStatus = dto.status;
    if (!isValidTaskStatusTransition(fromStatus, toStatus)) {
      throw new BadRequestException(
        `Khong the chuyen trang thai cong viec tu ${fromStatus} sang ${toStatus}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const task = await manager.findOneOrFail(Task, { where: { id, organizationId } });
      task.status = toStatus;
      const updated = await manager.save(task);

      const payload: TaskStatusChangedPayload = {
        taskId: updated.id,
        projectId: updated.projectId,
        fromStatus,
        toStatus,
        actorId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.TASK_STATUS_CHANGED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return updated;
    });
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const task = await this.findTaskOrFail(organizationId, id);
    // Cascade xoa TaskAssignee/TaskComment cua task nay qua FK onDelete: CASCADE.
    await this.taskRepo.remove(task);
  }

  /** Idempotent: khong tao ban ghi trung va khong phat lai event neu da duoc giao truoc do. */
  async assign(
    organizationId: string,
    id: string,
    actorId: string,
    userId: string,
  ): Promise<TaskAssignee> {
    const task = await this.findTaskOrFail(organizationId, id);

    const existing = await this.assigneeRepo.findOne({ where: { taskId: id, userId } });
    if (existing) return existing;

    return this.dataSource.transaction(async (manager) => {
      const assignee = await manager.save(manager.create(TaskAssignee, { taskId: id, userId }));

      const payload: TaskAssignedPayload = {
        taskId: id,
        projectId: task.projectId,
        assigneeId: userId,
        actorId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.TASK_ASSIGNED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return assignee;
    });
  }

  async unassign(organizationId: string, id: string, userId: string): Promise<void> {
    await this.findTaskOrFail(organizationId, id);
    const assignee = await this.assigneeRepo.findOne({ where: { taskId: id, userId } });
    if (assignee) await this.assigneeRepo.remove(assignee);
  }

  async addComment(
    organizationId: string,
    id: string,
    authorUserId: string,
    dto: CreateCommentDto,
  ): Promise<TaskComment> {
    await this.findTaskOrFail(organizationId, id);
    return this.commentRepo.save(
      this.commentRepo.create({ taskId: id, authorUserId, content: dto.content }),
    );
  }

  async findComments(
    organizationId: string,
    id: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<TaskComment>> {
    await this.findTaskOrFail(organizationId, id);

    const [data, total] = await this.commentRepo.findAndCount({
      where: { taskId: id },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  private async findTaskOrFail(organizationId: string, id: string): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id, organizationId } });
    if (!task) throw new NotFoundException('Khong tim thay cong viec');
    return task;
  }
}
