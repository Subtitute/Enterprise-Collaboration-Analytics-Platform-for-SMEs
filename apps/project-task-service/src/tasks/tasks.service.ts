import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
// 22/07/2026: them `In` - can cho truy van gop (GROUP BY... WHERE taskId IN (...)) khi nap
// assignees cho ca 1 trang Task trong findAll() (fix code review 22/07/2026, xem findAll() ben duoi).
import { DataSource, FindOptionsWhere, In, QueryFailedError, Repository } from 'typeorm';
import {
  ERROR_CODES,
  EVENT_TYPES,
  PaginatedResponse,
  PaginationQueryDto,
  PERMISSIONS,
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

/**
 * 22/07/2026 (fix code review, loi CRITICAL): shape THONG NHAT cho "nguoi phu trach" tra ve boi
 * CA HAI findAll() va findById() - khop dung field `assignees: { userId }[]` ma frontend da doc san
 * (apps/web/src/types/index.ts TaskAssignee { userId, fullName?, email? }, dung trong TaskCard.tsx
 * va TaskDetailModal.tsx) nen khong can sua frontend. Truoc ban sua nay: findAll() khong tra assignees
 * (Task.assignees la quan he lazy, khong eager: true tren entity), con findById() tra ve duoi ten
 * KHAC `assigneeIds: string[]` - ca 2 khien Kanban board (dung findAll qua useTasksQuery) va modal
 * chi tiet Task (doc lai tu cung danh sach do, xem TaskDetailModal.tsx) luon hien "Chua co ai duoc
 * phan cong" du DB co du lieu that. fullName/email luon undefined o day vi User song o DB rieng cua
 * IAM Service (khong the JOIN xuyen service) - frontend da tu fallback qua useUserNameMap().
 */
export interface TaskAssigneeRef {
  userId: string;
}

export type TaskWithAssignees = Omit<Task, 'assignees'> & { assignees: TaskAssigneeRef[] };

export interface TaskDetail extends TaskWithAssignees {
  commentCount: number;
}

/**
 * 22/07/2026 (fix code review, loi CRITICAL): entity TaskComment.authorUserId khong doi ten (van
 * khop cot DB va code noi bo khac) - chi tang response HTTP them alias `authorId` (giong het
 * `authorUserId`) vi frontend (apps/web/src/types/index.ts TaskComment.authorId,
 * TaskDetailModal.tsx dong ~165/168) doc field `authorId` chu khong phai `authorUserId`, khien
 * moi binh luan hien ten chung chung "Thanh vien" bat ke ai viet. Giu ca 2 field trong response
 * (khong bo authorUserId) de khong pha vo consumer noi bo khac dang doc field cu.
 */
export interface TaskCommentWithAuthorId extends TaskComment {
  authorId: string;
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

  /**
   * 22/07/2026 (fix code review, loi CRITICAL): truoc ban sua nay ham nay chi `findAndCount` Task
   * KHONG kem quan he `assignees` (khong eager tren entity) -> Kanban board va modal chi tiet Task
   * (ca 2 deu dung `GET /tasks` qua useTasksQuery, xem TaskCard.tsx/TaskDetailModal.tsx) luon nhan
   * `task.assignees === undefined`, hien "Chua co ai duoc phan cong" du DB co du lieu that. Sua bang
   * 1 truy van GOP DUY NHAT `TaskAssignee WHERE taskId IN (...)` sau khi da co danh sach id cua CA
   * TRANG (giong ky thuat batch GROUP BY... WHERE id IN (...) cua
   * ProjectsService.computeProjectStats()), tranh N+1 (moi Task 1 query rieng).
   *
   * 17/09/2026: truoc ban sua nay, moi nguoi giu TASK_VIEW (ke ca Employee) deu thay TOAN BO Task
   * cua to chuc du chi duoc giao viec o 1-2 du an. Dung TASK_DELETE (Manager/Org Admin co, Employee
   * khong co - xem DEFAULT_ROLE_PERMISSIONS trong packages/common-dto) lam ranh gioi "thay tat ca"
   * vs "chi thay Task cua du an co lien quan", cung nguyen tac da dung cho
   * ProjectsService.findAll() (PROJECT_CREATE) - khong them permission moi. Task "co lien quan"
   * = Task thuoc 1 du an nam trong getVisibleProjectIds() (xem ben duoi, mirror
   * ProjectsService.getVisibleProjectIds()).
   */
  async findAll(
    organizationId: string,
    query: TaskQueryDto,
    userId: string,
    permissions: string[],
  ): Promise<PaginatedResponse<TaskWithAssignees>> {
    const where: FindOptionsWhere<Task> = { organizationId };
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;

    if (!(permissions ?? []).includes(PERMISSIONS.TASK_DELETE)) {
      const visibleProjectIds = await this.getVisibleProjectIds(organizationId, userId);
      if (query.projectId) {
        // Client da tu loc theo 1 projectId cu the - neu du an do KHONG nam trong pham vi duoc
        // phep thay, tra rong thay vi am tham bo qua bo loc scoping (tranh Employee "vuot rao"
        // bang cach tu chon projectId cua du an khac ngay tren query string).
        if (!visibleProjectIds.includes(query.projectId)) {
          return paginate([], 0, query.page, query.limit);
        }
      } else {
        if (visibleProjectIds.length === 0) return paginate([], 0, query.page, query.limit);
        where.projectId = In(visibleProjectIds);
      }
    }

    const [data, total] = await this.taskRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const assigneesByTask = await this.loadAssigneesByTaskIds(data.map((task) => task.id));
    const enriched: TaskWithAssignees[] = data.map((task) => ({
      ...task,
      assignees: assigneesByTask.get(task.id) ?? [],
    }));

    return paginate(enriched, total, query.page, query.limit);
  }

  /**
   * 17/09/2026: cung 1 ranh gioi TASK_DELETE voi findAll() o tren - neu khong, Employee bi loc khoi
   * danh sach van co the "vuot rao" bang cach doan/nhan mot UUID Task cu the roi goi thang
   * GET /tasks/:id. Nem NotFoundException CUNG errorCode voi truong hop "khong ton tai" (khong
   * phai ForbiddenException) de khong lo lieu 1 Task co that su ton tai trong to chuc hay khong.
   */
  async findById(
    organizationId: string,
    id: string,
    userId: string,
    permissions: string[],
  ): Promise<TaskDetail> {
    const task = await this.findTaskOrFail(organizationId, id);

    if (!(permissions ?? []).includes(PERMISSIONS.TASK_DELETE)) {
      const visibleProjectIds = await this.getVisibleProjectIds(organizationId, userId);
      if (!visibleProjectIds.includes(task.projectId)) {
        throw new NotFoundException({ message: 'Khong tim thay cong viec', errorCode: ERROR_CODES.TASK_NOT_FOUND });
      }
    }

    const [assignees, commentCount] = await Promise.all([
      this.assigneeRepo.find({ where: { taskId: id } }),
      this.commentRepo.count({ where: { taskId: id } }),
    ]);

    // 22/07/2026: doi ten field `assigneeIds: string[]` -> `assignees: { userId }[]` de khop CHINH
    // XAC shape cua findAll() o tren (fix code review, loi CRITICAL - xem ghi chu tai TaskWithAssignees).
    return { ...task, assignees: assignees.map((a) => ({ userId: a.userId })), commentCount };
  }

  /**
   * 17/09/2026: danh sach id du an ma 1 nguoi khong co TASK_DELETE (Employee) duoc phep thay Task -
   * mirror CHINH XAC ProjectsService.getVisibleProjectIds() (apps/project-task-service/src/projects/
   * projects.service.ts) vi Project-Task Service chua tach rieng 1 module/service dung chung cho 2
   * concern Project/Task; nhan ban logic o day thay vi inject ProjectsService de tranh phinh to pham
   * vi sua doi (them dependency giua 2 module) chi cho 1 truy van doc. Dung `this.dataSource.
   * getRepository(Project)` thay vi them 1 @InjectRepository(Project) vao constructor - tranh doi
   * chu ky constructor cua TasksService (se lam vo hieu moi lenh `new TasksService(...)` co san
   * trong tasks.service.spec.ts).
   */
  private async getVisibleProjectIds(organizationId: string, userId: string): Promise<string[]> {
    const assignedRows = await this.assigneeRepo
      .createQueryBuilder('assignee')
      .innerJoin(Task, 'task', 'task.id = assignee.taskId')
      .select('DISTINCT task.projectId', 'projectId')
      .where('assignee.userId = :userId', { userId })
      .andWhere('task.organizationId = :organizationId', { organizationId })
      .getRawMany<{ projectId: string }>();

    const projectRepo = this.dataSource.getRepository(Project);
    const ownedProjects = await projectRepo.find({
      where: [
        { organizationId, leadUserId: userId },
        { organizationId, createdByUserId: userId },
      ],
      select: ['id'],
    });

    const ids = new Set<string>();
    for (const row of assignedRows) ids.add(row.projectId);
    for (const project of ownedProjects) ids.add(project.id);
    return Array.from(ids);
  }

  /** 22/07/2026: truy van gop assignees cho 1 tap taskId (trang hien tai), tranh N+1 - dung boi findAll(). */
  private async loadAssigneesByTaskIds(taskIds: string[]): Promise<Map<string, TaskAssigneeRef[]>> {
    const map = new Map<string, TaskAssigneeRef[]>();
    if (taskIds.length === 0) return map;

    const rows = await this.assigneeRepo.find({ where: { taskId: In(taskIds) } });
    for (const row of rows) {
      const list = map.get(row.taskId) ?? [];
      list.push({ userId: row.userId });
      map.set(row.taskId, list);
    }
    return map;
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
        throw new NotFoundException({
          message: 'Khong tim thay du an trong to chuc cua ban',
          errorCode: ERROR_CODES.PROJECT_NOT_FOUND_IN_ORG,
        });
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
      throw new BadRequestException({
        message: `Khong the chuyen trang thai cong viec tu ${existing.status} sang ${toStatus}`,
        errorCode: ERROR_CODES.TASK_STATUS_TRANSITION_INVALID,
        errorParams: { from: existing.status, to: toStatus },
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const task = await manager.findOneOrFail(Task, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });

      // Re-validate dua tren trang thai vua duoc khoa (khong dung bien `existing` da co the stale).
      const fromStatus = task.status;
      if (!isValidTaskStatusTransition(fromStatus, toStatus)) {
        throw new BadRequestException({
          message: `Khong the chuyen trang thai cong viec tu ${fromStatus} sang ${toStatus}`,
          errorCode: ERROR_CODES.TASK_STATUS_TRANSITION_INVALID,
          errorParams: { from: fromStatus, to: toStatus },
        });
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
   *
   * 22/07/2026 (fix code review, loi MAJOR - race condition xoa dong thoi): ban truoc do doc
   * `findTaskOrFail` KHONG khoa roi `manager.remove(task)` vo dieu kien ben trong transaction -
   * `manager.remove()` cua TypeORM khong bao affected-row-count va KHONG nem loi neu row da bi
   * 1 request dong thoi khac xoa mat truoc do, nen 2 request cung xoa 1 Task se cung ghi outbox
   * TASK_DELETED -> Analytics dem trung 1 lan xoa thanh 2 event. Sua bang cach doc LAI ben trong
   * transaction voi pessimistic write lock (dung EXACT pattern cua updateStatus() o tren); neu
   * khong con thay row (da bi xoa giua luc pre-check va luc khoa) thi return som, KHONG xoa lai
   * va KHONG ghi outbox lai - dung la ngu nghia DELETE idempotent chuan REST. Van giu pre-check
   * khong khoa o dau ham (findTaskOrFail) de tra 404 nhanh cho id chua tung ton tai/sai to chuc.
   */
  async remove(organizationId: string, actorId: string, id: string): Promise<void> {
    await this.findTaskOrFail(organizationId, id);

    await this.dataSource.transaction(async (manager) => {
      const task = await manager.findOne(Task, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!task) return;

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
   *
   * 25/07/2026 (audit - han che da biet, CHAP NHAN, khong sua trong dot nay): ham nay KHONG xac
   * minh `userId` truyen vao thuc su thuoc `organizationId` cua nguoi goi truoc khi tao
   * TaskAssignee - Project-Task Service khong co cach nao tra cuu du lieu user/org cua mot
   * service KHAC (IAM Service) vi hien repo nay chua co co che goi HTTP noi bo giua cac service
   * (da grep toan repo: khong co HttpService/internal API client nao giua cac service - can them
   * ha tang cross-service moi, ngoai pham vi dot sua nay). Muc do NGHIEM TRONG THAP: khong lam lo
   * du lieu cua to chuc khac (khong doc/ghi gi ngoai Task cua chinh organizationId nay), chi cho
   * phep gan mot Task cho 1 userId khong thuc su thuoc to chuc - userId "ao" do se khong bao gio
   * hien len "cong viec cua toi" cho bat ky nguoi dung that nao. Xem han che tuong tu (cung ly do)
   * tai FilesService.share() (apps/document-service/src/files/files.service.ts).
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

  /** 22/07/2026: response them alias `authorId` (xem TaskCommentWithAuthorId) - fix loi CRITICAL "khong hien ten nguoi viet binh luan". */
  async addComment(
    organizationId: string,
    id: string,
    authorUserId: string,
    dto: CreateCommentDto,
  ): Promise<TaskCommentWithAuthorId> {
    await this.findTaskOrFail(organizationId, id);
    const saved = await this.commentRepo.save(
      this.commentRepo.create({ taskId: id, authorUserId, content: dto.content }),
    );
    return { ...saved, authorId: saved.authorUserId };
  }

  /** 22/07/2026: response them alias `authorId` (xem TaskCommentWithAuthorId) - fix loi CRITICAL "khong hien ten nguoi viet binh luan". */
  async findComments(
    organizationId: string,
    id: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<TaskCommentWithAuthorId>> {
    await this.findTaskOrFail(organizationId, id);

    const [data, total] = await this.commentRepo.findAndCount({
      where: { taskId: id },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    const enriched = data.map((c) => ({ ...c, authorId: c.authorUserId }));
    return paginate(enriched, total, query.page, query.limit);
  }

  private async findTaskOrFail(organizationId: string, id: string): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id, organizationId } });
    if (!task) throw new NotFoundException({ message: 'Khong tim thay cong viec', errorCode: ERROR_CODES.TASK_NOT_FOUND });
    return task;
  }
}
