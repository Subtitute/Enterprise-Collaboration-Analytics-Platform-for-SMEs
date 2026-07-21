import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, QueryFailedError, Repository } from 'typeorm';
import {
  EVENT_TYPES,
  PaginatedResponse,
  PaginationQueryDto,
  TaskAssignedPayload,
  TaskCreatedPayload,
  TaskDeletedPayload,
  TaskStatus,
  TaskStatusChangedPayload,
  paginate,
} from '@app/common-dto';
import { Task } from '../entities/task.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { TaskComment } from '../entities/task-comment.entity';
import { TaskStatusHistory } from '../entities/task-status-history.entity';
import { Project } from '../entities/project.entity';
import { OutboxService } from '../outbox/outbox.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { isValidTaskStatusTransition } from './task-status.util';

const PRODUCER = 'project-task-service';
/** Ma loi Postgres cho vi pham rang buoc unique (vd @Unique(['taskId','userId']) tren TaskAssignee). */
const POSTGRES_UNIQUE_VIOLATION = '23505';

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
    @InjectRepository(TaskStatusHistory)
    private readonly statusHistoryRepo: Repository<TaskStatusHistory>,
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

  /**
   * Tao cong viec moi. QUAN TRONG (fix code review 21/07/2026, Technical_Spec.md muc 6):
   * phai xac minh dto.projectId thuoc dung organizationId cua nguoi goi truoc khi tao Task,
   * neu khong 1 to chuc co the tao Task gan vao Project cua to chuc KHAC chi bang cach doan UUID.
   * Kiem tra nay chay BEN TRONG cung transaction voi viec tao Task + ghi Outbox.
   */
  async create(organizationId: string, actorId: string, dto: CreateTaskDto): Promise<Task> {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, {
        where: { id: dto.projectId, organizationId },
      });
      if (!project) {
        throw new NotFoundException('Khong tim thay du an trong to chuc cua ban');
      }

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
   *
   * Fix code review 21/07/2026 (race condition keo-tha dong thoi): pre-check ben duoi chi de fail-fast
   * (UX phan hoi loi nhanh khi ro rang sai des tu dau); nguon su that duy nhat la ban ghi duoc doc LAI
   * BEN TRONG transaction voi pessimistic write lock, roi re-validate isValidTaskStatusTransition mot
   * lan nua truoc khi apply - dam bao 2 request doi trang thai dong thoi khong cung "vuot qua" pre-check
   * dua tren snapshot cu roi ca 2 cung ghi de len nhau.
   */
  async updateStatus(
    organizationId: string,
    id: string,
    actorId: string,
    dto: UpdateTaskStatusDto,
  ): Promise<Task> {
    const existing = await this.findTaskOrFail(organizationId, id);
    const toStatus = dto.status;

    if (!isValidTaskStatusTransition(existing.status, toStatus)) {
      throw new BadRequestException(
        `Khong the chuyen trang thai cong viec tu ${existing.status} sang ${toStatus}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const task = await manager.findOneOrFail(Task, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });

      // Re-validate dua tren trang thai vua duoc khoa (khong dung bien `existing` da co the stale).
      const fromStatus = task.status;
      if (!isValidTaskStatusTransition(fromStatus, toStatus)) {
        throw new BadRequestException(
          `Khong the chuyen trang thai cong viec tu ${fromStatus} sang ${toStatus}`,
        );
      }

      task.status = toStatus;
      const updated = await manager.save(task);

      const changedAt = new Date();
      await manager.save(
        manager.create(TaskStatusHistory, {
          taskId: updated.id,
          organizationId,
          fromStatus,
          toStatus,
          actorId,
          changedAt,
        }),
      );

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

  /** Lich su doi trang thai cua 1 Task (Wireframe.md muc 4.2 - modal chi tiet Task), sap xep tang dan theo thoi gian. */
  async findStatusHistory(
    organizationId: string,
    id: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<TaskStatusHistory>> {
    await this.findTaskOrFail(organizationId, id);

    const [data, total] = await this.statusHistoryRepo.findAndCount({
      where: { taskId: id, organizationId },
      order: { changedAt: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  /**
   * Fix code review 21/07/2026: xoa cung phai phat Outbox event (task.deleted) trong CUNG
   * transaction voi thao tac xoa, neu khong Analytics se dem nham cong viec da bi xoa cung.
   */
  async remove(organizationId: string, actorId: string, id: string): Promise<void> {
    const task = await this.findTaskOrFail(organizationId, id);

    await this.dataSource.transaction(async (manager) => {
      // Cascade xoa TaskAssignee/TaskComment/TaskStatusHistory cua task nay qua FK onDelete: CASCADE.
      await manager.remove(task);

      const payload: TaskDeletedPayload = {
        taskId: task.id,
        projectId: task.projectId,
        actorId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.TASK_DELETED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });
    });
  }

  /**
   * Idempotent: khong tao ban ghi trung va khong phat lai event neu da duoc giao truoc do.
   * Fix code review 21/07/2026 (race condition): pre-check bang findOne o tren khong du de
   * chong 2 request dong thoi giao CUNG 1 user - ca 2 co the deu "khong thay ban ghi" roi cung
   * INSERT, va ban ghi thua se vi pham @Unique(['taskId','userId']) tren TaskAssignee. Thay vi
   * de loi 500 chung chung bubble len, bat QueryFailedError ma Postgres code 23505 va coi day
   * la truong hop idempotent hop le - tra ve ban ghi da duoc tao boi request thang cuoc.
   */
  async assign(
    organizationId: string,
    id: string,
    actorId: string,
    userId: string,
  ): Promise<TaskAssignee> {
    const task = await this.findTaskOrFail(organizationId, id);

    const existing = await this.assigneeRepo.findOne({ where: { taskId: id, userId } });
    if (existing) return existing;

    try {
      return await this.dataSource.transaction(async (manager) => {
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
    } catch (error) {
      // Kieu QueryFailedError cua typeorm khong khai bao san `code` trong .d.ts, nhung driverError
      // cua pg driver luon co truong nay khi Postgres tra ve loi (vd '23505' = unique_violation).
      const pgErrorCode =
        error instanceof QueryFailedError
          ? (error.driverError as { code?: string } | undefined)?.code
          : undefined;
      if (pgErrorCode === POSTGRES_UNIQUE_VIOLATION) {
        const race = await this.assigneeRepo.findOne({ where: { taskId: id, userId } });
        if (race) return race;
      }
      throw error;
    }
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
