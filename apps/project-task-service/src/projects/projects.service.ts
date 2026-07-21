import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, ILike, Repository } from 'typeorm';
import {
  EVENT_TYPES,
  PaginatedResponse,
  ProjectCompletedPayload,
  ProjectCreatedPayload,
  ProjectDeletedPayload,
  ProjectStatus,
  TaskStatus,
  paginate,
} from '@app/common-dto';
import { Project } from '../entities/project.entity';
import { Task } from '../entities/task.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { OutboxService } from '../outbox/outbox.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';

const PRODUCER = 'project-task-service';

/** Du an kem thong tin tong hop cho danh sach du an (Wireframe.md muc 4.1). */
export interface ProjectListItem extends Project {
  /** Ty le % Task o trang thai DONE tren tong so Task cua du an. */
  completionRate: number;
  /** So thanh vien duy nhat (distinct userId) dang duoc giao viec trong du an. */
  memberCount: number;
}

interface ProjectStats {
  completionRate: number;
  memberCount: number;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(TaskAssignee) private readonly assigneeRepo: Repository<TaskAssignee>,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * Danh sach du an (Wireframe.md muc 4.1): ho tro tim kiem theo ten (khong phan biet hoa/thuong)
   * va loc theo trang thai; tra ve kem completionRate/memberCount tinh gop theo trang hien tai
   * (khong query N+1 - 1 query aggregate cho tong so Task, 1 cho so Task DONE, 1 cho so thanh vien
   * duy nhat, tat ca deu GROUP BY project_id va loc theo danh sach id cua trang hien tai).
   * Khong co bo loc theo phong ban - dieu chinh 21/07/2026, xem Technical_Spec.md muc 14.
   */
  async findAll(
    organizationId: string,
    query: ProjectQueryDto,
  ): Promise<PaginatedResponse<ProjectListItem>> {
    const where: FindOptionsWhere<Project> = { organizationId };
    if (query.status) where.status = query.status;
    if (query.search) where.name = ILike(`%${query.search}%`);

    const [data, total] = await this.projectRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const stats = await this.computeProjectStats(data.map((project) => project.id));
    const enriched: ProjectListItem[] = data.map((project) => {
      const stat = stats.get(project.id) ?? { completionRate: 0, memberCount: 0 };
      return { ...project, ...stat };
    });

    return paginate(enriched, total, query.page, query.limit);
  }

  async findById(organizationId: string, id: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!project) throw new NotFoundException('Khong tim thay du an');
    return project;
  }

  async create(organizationId: string, actorId: string, dto: CreateProjectDto): Promise<Project> {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.save(
        manager.create(Project, {
          organizationId,
          name: dto.name,
          description: dto.description ?? null,
          status: ProjectStatus.ACTIVE,
          createdByUserId: actorId,
        }),
      );

      const payload: ProjectCreatedPayload = {
        projectId: project.id,
        name: project.name,
        actorId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.PROJECT_CREATED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return project;
    });
  }

  async update(organizationId: string, id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!project) throw new NotFoundException('Khong tim thay du an');

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    return this.projectRepo.save(project);
  }

  async complete(organizationId: string, id: string, actorId: string): Promise<Project> {
    const existing = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Khong tim thay du an');
    if (existing.status === ProjectStatus.COMPLETED) {
      throw new BadRequestException('Du an nay da o trang thai hoan thanh');
    }

    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOneOrFail(Project, { where: { id, organizationId } });
      project.status = ProjectStatus.COMPLETED;
      const updated = await manager.save(project);

      const payload: ProjectCompletedPayload = { projectId: updated.id, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.PROJECT_COMPLETED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return updated;
    });
  }

  /**
   * Fix code review 21/07/2026: xoa cung phai phat Outbox event (project.deleted) trong CUNG
   * transaction voi thao tac xoa, neu khong Analytics se dem nham du an da bi xoa cung.
   */
  async remove(organizationId: string, actorId: string, id: string): Promise<void> {
    const project = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!project) throw new NotFoundException('Khong tim thay du an');

    await this.dataSource.transaction(async (manager) => {
      // Cascade xoa toan bo Task/TaskAssignee/TaskComment/TaskStatusHistory cua du an nay qua FK onDelete: CASCADE.
      await manager.remove(project);

      const payload: ProjectDeletedPayload = { projectId: project.id, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.PROJECT_DELETED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });
    });
  }

  /** Tinh completionRate/memberCount cho 1 tap projectId (trang hien tai) bang cac query GROUP BY, tranh N+1. */
  private async computeProjectStats(projectIds: string[]): Promise<Map<string, ProjectStats>> {
    const stats = new Map<string, ProjectStats>();
    if (projectIds.length === 0) return stats;
    for (const id of projectIds) stats.set(id, { completionRate: 0, memberCount: 0 });

    const [totalRows, doneRows, memberRows] = await Promise.all([
      this.taskRepo
        .createQueryBuilder('task')
        .select('task.projectId', 'projectId')
        .addSelect('COUNT(*)', 'count')
        .where('task.projectId IN (:...projectIds)', { projectIds })
        .groupBy('task.projectId')
        .getRawMany<{ projectId: string; count: string }>(),
      this.taskRepo
        .createQueryBuilder('task')
        .select('task.projectId', 'projectId')
        .addSelect('COUNT(*)', 'count')
        .where('task.projectId IN (:...projectIds)', { projectIds })
        .andWhere('task.status = :status', { status: TaskStatus.DONE })
        .groupBy('task.projectId')
        .getRawMany<{ projectId: string; count: string }>(),
      this.assigneeRepo
        .createQueryBuilder('assignee')
        .innerJoin(Task, 'task', 'task.id = assignee.taskId')
        .select('task.projectId', 'projectId')
        .addSelect('COUNT(DISTINCT assignee.userId)', 'count')
        .where('task.projectId IN (:...projectIds)', { projectIds })
        .groupBy('task.projectId')
        .getRawMany<{ projectId: string; count: string }>(),
    ]);

    const totalByProject = new Map(totalRows.map((row) => [row.projectId, parseInt(row.count, 10)]));
    const doneByProject = new Map(doneRows.map((row) => [row.projectId, parseInt(row.count, 10)]));

    for (const id of projectIds) {
      const total = totalByProject.get(id) ?? 0;
      const done = doneByProject.get(id) ?? 0;
      const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
      stats.set(id, { completionRate, memberCount: stats.get(id)?.memberCount ?? 0 });
    }

    for (const row of memberRows) {
      const prev = stats.get(row.projectId) ?? { completionRate: 0, memberCount: 0 };
      stats.set(row.projectId, { ...prev, memberCount: parseInt(row.count, 10) });
    }

    return stats;
  }
}
