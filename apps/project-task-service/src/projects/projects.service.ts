import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  EVENT_TYPES,
  PaginatedResponse,
  PaginationQueryDto,
  ProjectCompletedPayload,
  ProjectCreatedPayload,
  ProjectStatus,
  paginate,
} from '@app/common-dto';
import { Project } from '../entities/project.entity';
import { OutboxService } from '../outbox/outbox.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const PRODUCER = 'project-task-service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    private readonly outboxService: OutboxService,
  ) {}

  async findAll(
    organizationId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Project>> {
    const [data, total] = await this.projectRepo.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
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

  async remove(organizationId: string, id: string): Promise<void> {
    const project = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!project) throw new NotFoundException('Khong tim thay du an');
    // Cascade xoa toan bo Task/TaskAssignee/TaskComment cua du an nay qua FK onDelete: CASCADE.
    await this.projectRepo.remove(project);
  }
}
