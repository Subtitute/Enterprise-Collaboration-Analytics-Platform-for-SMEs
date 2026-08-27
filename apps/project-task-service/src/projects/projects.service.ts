import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, ILike, Repository } from 'typeorm';
import {
  ERROR_CODES,
  EVENT_TYPES,
  PaginatedResponse,
  ProjectCompletedPayload,
  ProjectCreatedPayload,
  ProjectDeletedPayload,
  ProjectStatus,
  TaskDeletedPayload,
  TaskStatus,
  paginate,
} from '@app/common-dto';
import { Project, ProjectPriority } from '../entities/project.entity';
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

  /**
   * 22/07/2026 (fix code review, loi MAJOR): truoc ban sua nay ham nay tra ve entity Project "tho",
   * thieu ca completionRate lan memberCount ma findAll() da tinh san cho moi Project trong danh sach -
   * khien trang chi tiet 1 du an (GET /projects/:id) hien % hoan thanh/so thanh vien SAI (undefined,
   * frontend fallback ve 0%) trong khi trang danh sach cung du an do lai hien dung. Goi lai
   * computeProjectStats() (chi truyen 1 phan tu [id], ham nay von thiet ke cho batch nen nhan mang)
   * de tra ve DUNG shape ProjectListItem ma findAll() da tra, khong con lech giua 2 endpoint.
   */
  async findById(organizationId: string, id: string): Promise<ProjectListItem> {
    const project = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!project) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });

    const stats = await this.computeProjectStats([id]);
    const stat = stats.get(id) ?? { completionRate: 0, memberCount: 0 };
    return { ...project, ...stat };
  }

  async create(organizationId: string, actorId: string, dto: CreateProjectDto): Promise<Project> {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.save(
        manager.create(Project, {
          organizationId,
          name: dto.name,
          description: dto.description ?? null,
          // 22/07/2026 (fix code review, loi MINOR - Fix 8): wire dueDate tu DTO vao entity (truoc do
          // khong co cot nay nen khong the gan gi ca - xem project.entity.ts/create-project.dto.ts).
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: ProjectStatus.ACTIVE,
          // 26/08/2026 (fix code review, loi MAJOR - Fix 3): wire priority/leadUserId tu DTO vao
          // entity (truoc do khong co 2 cot nay nen khong the gan gi ca - xem project.entity.ts).
          priority: dto.priority ?? ProjectPriority.MEDIUM,
          leadUserId: dto.leadUserId ?? null,
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
    if (!project) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    // 22/07/2026 (fix code review, loi MINOR - Fix 8): wire dueDate tu DTO vao entity (cung ly do voi create()).
    if (dto.dueDate !== undefined) project.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    // 26/08/2026 (fix code review, loi MAJOR - Fix 3): wire priority/leadUserId tu DTO vao entity
    // (cung ly do voi create()) - an toan de gan THANG (khong can lock/state-machine nhu status).
    if (dto.priority !== undefined) project.priority = dto.priority;
    if (dto.leadUserId !== undefined) project.leadUserId = dto.leadUserId;
    // 26/08/2026 (fix code review, loi MAJOR): DA XOA nhanh `if (dto.status !== undefined)
    // project.status = dto.status;` o day - UpdateProjectDto khong con field `status` (xem chu
    // thich tai update-project.dto.ts). update() nay chi doc/ghi ma khong lock, khong kiem tra
    // state-machine, khong ghi Outbox event nao ca, nen tuyet doi khong duoc phep dung de doi
    // status - viec do phai di qua complete()/reopen()/archive() ben duoi (co day du 3 dieu kien
    // tren).
    return this.projectRepo.save(project);
  }

  /**
   * 22/07/2026 (fix code review, loi MAJOR - race condition doi trang thai dong thoi): ban truoc
   * do doc pre-check KHONG khoa, roi doc LAI ben trong transaction bang `findOneOrFail` cung KHONG
   * khoa - neu 2 request `complete()` cung 1 Project chay dong thoi, ca 2 co the deu doc duoc
   * status ACTIVE (truoc khi request kia commit) roi CA HAI cung set COMPLETED va cung ghi outbox
   * PROJECT_COMPLETED (double-emit, Analytics dem trung). Sua bang EXACT pattern cua
   * TasksService.updateStatus(): doc lai ben trong transaction voi pessimistic write lock, roi
   * re-check `status !== COMPLETED` MOT LAN NUA sau khi da khoa truoc khi apply - request thua
   * cuoc (row da bi request thang cuoc doi thanh COMPLETED giua luc pre-check va luc khoa) nhan
   * lai dung loi "da hoan thanh" (400) thay vi am tham ghi de/double-emit.
   */
  async complete(organizationId: string, id: string, actorId: string): Promise<Project> {
    const existing = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });
    // 26/08/2026 (fix code review lan 4): truoc ban sua nay, ca pre-check nay LAN re-check ben
    // trong transaction o duoi deu "return existing/project" am tham thay vi nem loi - le ra phai
    // nem BadRequestException(PROJECT_ALREADY_COMPLETED) giong het pattern archive() (ma error code
    // nay da duoc khai bao san trong packages/common-dto tu truoc nhung chua bao gio duoc dung o
    // day) - lech voi chinh test rieng cho race condition nay (viet 22/07/2026, luon mong doi
    // BadRequestException cho request "thua cuoc"). Sua ca 2 nhanh de nhat quan voi archive().
    if (existing.status === ProjectStatus.COMPLETED) {
      throw new BadRequestException({ message: 'Du an nay da hoan thanh', errorCode: ERROR_CODES.PROJECT_ALREADY_COMPLETED });
    }

    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });
      // Re-check dua tren trang thai vua duoc khoa (khong dung bien `existing` da co the stale).
      if (project.status === ProjectStatus.COMPLETED) {
        throw new BadRequestException({ message: 'Du an nay da hoan thanh', errorCode: ERROR_CODES.PROJECT_ALREADY_COMPLETED });
      }

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

  async reopen(organizationId: string, id: string, actorId: string): Promise<Project> {
    const existing = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });
    if (existing.status === ProjectStatus.ACTIVE) {
      return existing;
    }

    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });

      project.status = ProjectStatus.ACTIVE;
      const updated = await manager.save(project);
      return updated;
    });
  }

  /**
   * 22/07/2026 (fix code review, loi MINOR, hoan thien tinh nang): ProjectStatus.ARCHIVED da khai
   * bao san trong packages/common-dto (enums/task-status.enum.ts) va frontend da co san bo loc theo
   * trang thai nay (xem ProjectQueryDto.status), nhung KHONG co endpoint/service method nao tung gan
   * trang thai do cho Project - dead code, khong ai tao duoc du lieu de loc thu. Bo sung endpoint luu
   * tru, mirror CHINH XAC pattern khoa pessimistic_write + re-check cua complete() o tren (tranh dung
   * lai loi race condition da sua o do). KHONG ghi Outbox event: EVENT_TYPES (packages/common-dto,
   * ngoai pham vi sua trong batch nay) chua co PROJECT_ARCHIVED hay 1 event dang PROJECT_UPDATED
   * chung nao phu hop - phat nham PROJECT_COMPLETED se sai ngu nghia cho Analytics, nen bo qua buoc
   * ghi Outbox thay vi phat sai.
   */
  // 22/07/2026: actorId hien khong dung ben trong ham (khong co outbox event de ghi actor, xem
  // ghi chu tren) - giu tham so de dong bo chu ky voi complete()/remove() va san sang cho audit
  // log/outbox trong tuong lai neu EVENT_TYPES bo sung PROJECT_ARCHIVED.
  async archive(organizationId: string, id: string, actorId: string): Promise<Project> {
    const existing = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });
    if (existing.status === ProjectStatus.ARCHIVED) {
      throw new BadRequestException({ message: 'Du an nay da duoc luu tru', errorCode: ERROR_CODES.PROJECT_ALREADY_ARCHIVED });
    }

    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });
      if (project.status === ProjectStatus.ARCHIVED) {
        throw new BadRequestException({ message: 'Du an nay da duoc luu tru', errorCode: ERROR_CODES.PROJECT_ALREADY_ARCHIVED });
      }

      project.status = ProjectStatus.ARCHIVED;
      return manager.save(project);
    });
  }

  /**
   * Fix code review 21/07/2026: xoa cung phai phat Outbox event (project.deleted) trong CUNG
   * transaction voi thao tac xoa, neu khong Analytics se dem nham du an da bi xoa cung.
   *
   * 22/07/2026 (fix code review, loi MAJOR - race condition xoa dong thoi, CUNG file voi Fix 3 tren):
   * ban truoc do doc pre-check KHONG khoa roi `manager.remove(project)` vo dieu kien - neu 2 request
   * `remove()` cung 1 Project chay dong thoi, ca 2 deu "thay" project roi cung xoa va cung ghi outbox
   * PROJECT_DELETED (double-emit). Sua bang doc lai ben trong transaction voi pessimistic write lock;
   * neu khong con thay row (da bi 1 request khac xoa mat giua luc pre-check va luc khoa) thi return
   * som, KHONG xoa lai va KHONG ghi outbox lai - dung ngu nghia DELETE idempotent chuan REST.
   *
   * 22/07/2026 (fix code review, loi MAJOR - Fix 4, thieu event task.deleted khi cascade): Task co
   * `onDelete: CASCADE` tren FK ve Project (task.entity.ts) nen xoa Project se HARD-DELETE toan bo
   * Task cua no o tang DB, nhung truoc ban sua nay chi 1 event PROJECT_DELETED duy nhat duoc ghi ->
   * Analytics khong bao gio biet cac Task con da bi xoa cung (dem sai so Task con "song"). Sua bang
   * cach, TRUOC khi xoa Project, truy van danh sach id Task thuoc du an (ben trong CUNG transaction,
   * SAU khi da khoa Project - dam bao doc dung tap Task tai thoi diem sap xoa), roi SAU khi xoa xong
   * ghi THEM 1 outbox event TASK_DELETED cho MOI Task do - cung pattern FoldersService.remove() cua
   * Document Service da dung cho truong hop cascade tuong tu (xoa thu muc cascade xoa file con, ghi
   * 1 DOCUMENT_DELETED / file).
   */
  async remove(organizationId: string, actorId: string, id: string): Promise<void> {
    const existing = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });

    await this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) return;

      const orphanedTaskIds = (
        await manager.find(Task, { where: { projectId: id }, select: ['id'] })
      ).map((task) => task.id);

      // Cascade xoa toan bo Task/TaskAssignee/TaskComment/TaskStatusHistory cua du an nay qua FK onDelete: CASCADE.
      await manager.remove(project);

      const payload: ProjectDeletedPayload = { projectId: project.id, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.PROJECT_DELETED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      for (const taskId of orphanedTaskIds) {
        const taskPayload: TaskDeletedPayload = { taskId, projectId: id, actorId };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.TASK_DELETED,
          organizationId,
          producer: PRODUCER,
          payload: taskPayload as unknown as Record<string, unknown>,
        });
      }
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
