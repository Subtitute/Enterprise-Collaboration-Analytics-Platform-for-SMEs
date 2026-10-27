import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
// 17/09/2026: them `In` - can cho truy van "du an nam trong danh sach id duoc phep thay" khi loc
// theo pham vi cho Employee (xem findAll()/findById()/getVisibleProjectIds() ben duoi).
import { DataSource, FindOptionsWhere, ILike, In, QueryFailedError, Repository } from 'typeorm';
import {
  ERROR_CODES,
  EVENT_TYPES,
  PaginatedResponse,
  PERMISSIONS,
  ProjectCompletedPayload,
  ProjectCreatedPayload,
  ProjectDeletedPayload,
  // 26/10/2026: su kien thanh vien/nguoi phu trach - tai lieu theo pham vi du an (Document Service).
  ProjectLeadChangedPayload,
  ProjectMemberAddedPayload,
  ProjectMemberRemovedPayload,
  ProjectStatus,
  TaskDeletedPayload,
  TaskStatus,
  paginate,
} from '@app/common-dto';
import { Project, ProjectPriority } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { Task } from '../entities/task.entity';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { OutboxService } from '../outbox/outbox.service';
// 26/10/2026: pham vi xem 3 cap (Org Admin/Manager theo phong ban/Employee) - xem resolveScopeUserIds().
import { ScopeCaller, resolveScopeUserIds } from '../user-directory/user-directory';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';

const PRODUCER = 'project-task-service';
/** Ma loi Postgres cho vi pham rang buoc unique (vd @Unique(['projectId','userId']) tren ProjectMember). */
const POSTGRES_UNIQUE_VIOLATION = '23505';

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
   *
   * 17/09/2026: truoc ban sua nay, moi nguoi giu PROJECT_VIEW (ke ca Employee) deu thay TOAN BO du
   * an cua to chuc - Employee chi duoc giao viec o 1-2 du an van doc duoc danh sach/thong tin cua
   * moi du an khac, lo du lieu ngoai pham vi cong viec cua ho. Dung PROJECT_CREATE (Manager/Org
   * Admin co, Employee khong co - xem DEFAULT_ROLE_PERMISSIONS trong packages/common-dto) lam ranh
   * gioi "thay tat ca" vs "chi thay du an co lien quan" thay vi them permission moi (khong can thiet
   * - ranh gioi nay TRUNG KHOP hoan toan voi ranh gioi PROJECT_CREATE da co san). "Co lien quan" suy
   * tu TaskAssignee (chua co bang thanh vien du an rieng) - xem getVisibleProjectIds().
   *
   * 26/10/2026: Manager KHONG con thay toan bo du an nhu Org Admin - chi du an minh lien quan CONG
   * du an co it nhat 1 thanh vien/nguoi duoc giao Task/lead/nguoi tao thuoc phong ban cua Manager
   * (departmentId tu JWT, thanh vien phong ban tu read-model dim_user). Org Admin (USER_MANAGE) van
   * thay tat ca; Employee giu nguyen quy tac cu. Quyen ghi (PROJECT_UPDATE...) khong doi.
   */
  async findAll(
    organizationId: string,
    query: ProjectQueryDto,
    userId: string,
    permissions: string[],
    departmentId: string | null = null,
  ): Promise<PaginatedResponse<ProjectListItem>> {
    const where: FindOptionsWhere<Project> = { organizationId };
    if (query.status) where.status = query.status;
    if (query.search) where.name = ILike(`%${query.search}%`);

    const scopeUserIds = await resolveScopeUserIds(
      this.dataSource,
      organizationId,
      userId,
      permissions ?? [],
      PERMISSIONS.PROJECT_CREATE,
      departmentId,
    );
    if (scopeUserIds) {
      const visibleIds = await this.getVisibleProjectIds(organizationId, scopeUserIds);
      if (visibleIds.length === 0) return paginate([], 0, query.page, query.limit);
      where.id = In(visibleIds);
    }

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
   *
   * 17/09/2026: cung 1 ranh gioi PROJECT_CREATE voi findAll() o tren - neu khong, Employee bi loc
   * khoi danh sach van co the "vuot rao" bang cach doan/nhan mot UUID du an cu the roi goi thang
   * GET /projects/:id. Nem NotFoundException CUNG errorCode voi truong hop "khong ton tai" (khong
   * phai ForbiddenException) de khong lo lieu 1 du an co that su ton tai trong to chuc hay khong.
   *
   * 26/10/2026: cung pham vi 3 cap voi findAll() o tren (xem assertProjectVisible()).
   */
  async findById(
    organizationId: string,
    id: string,
    userId: string,
    permissions: string[],
    departmentId: string | null = null,
  ): Promise<ProjectListItem> {
    const project = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!project) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });

    await this.assertProjectVisible(organizationId, id, userId, permissions, departmentId);

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
          //
          // 27/08/2026 (ghi nhan qua ra soat lai, KHONG sua): `leadUserId` khong duoc xac minh thuc
          // su thuoc `organizationId` cua nguoi goi - CUNG mot han che (cung ly do) da ghi nhan tai
          // TasksService.assign() (apps/project-task-service/src/tasks/tasks.service.ts): repo nay
          // chua co co che goi HTTP noi bo giua cac service de tra cuu du lieu user/org cua IAM
          // Service. Muc do NGHIEM TRONG THAP: khong lam lo du lieu to chuc khac (khong doc/ghi gi
          // ngoai Project cua chinh organizationId nay), chi cho phep gan leadUserId "ao" khong
          // thuc su thuoc to chuc - frontend chi resolve ten nguoi phu trach qua danh sach
          // GET /users (da loc theo to chuc) nen 1 id ao se don gian khong hien ten ai ca.
          priority: dto.priority ?? ProjectPriority.MEDIUM,
          leadUserId: dto.leadUserId ?? null,
          createdByUserId: actorId,
        }),
      );

      const payload: ProjectCreatedPayload = {
        projectId: project.id,
        name: project.name,
        actorId,
        // 26/10/2026: Document Service cap quyen tai lieu du an cho lead ngay tu luc tao.
        leadUserId: project.leadUserId ?? null,
        // 26/10/2026: nguoi tao cung "thuoc du an" - Document Service cap quyen tai lieu cho nguoi tao.
        createdByUserId: project.createdByUserId,
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

  // 26/10/2026: them `actorId` - doi nguoi phu trach gio phat PROJECT_LEAD_CHANGED (xem cuoi ham).
  async update(organizationId: string, id: string, dto: UpdateProjectDto, actorId: string, caller?: ScopeCaller): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!project) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });
    await this.assertCallerScope(organizationId, id, caller);
    const previousLeadUserId = project.leadUserId ?? null;

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    // 22/07/2026 (fix code review, loi MINOR - Fix 8): wire dueDate tu DTO vao entity (cung ly do voi create()).
    if (dto.dueDate !== undefined) project.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    // 26/08/2026 (fix code review, loi MAJOR - Fix 3): wire priority/leadUserId tu DTO vao entity
    // (cung ly do voi create()) - an toan de gan THANG (khong can lock/state-machine nhu status).
    // leadUserId khong xac minh thuoc dung to chuc - xem giai thich chi tiet tai create() o tren.
    if (dto.priority !== undefined) project.priority = dto.priority;
    if (dto.leadUserId !== undefined) project.leadUserId = dto.leadUserId;
    // 26/08/2026 (fix code review, loi MAJOR): DA XOA nhanh `if (dto.status !== undefined)
    // project.status = dto.status;` o day - UpdateProjectDto khong con field `status` (xem chu
    // thich tai update-project.dto.ts). update() nay chi doc/ghi ma khong lock, khong kiem tra
    // state-machine, khong ghi Outbox event nao ca, nen tuyet doi khong duoc phep dung de doi
    // status - viec do phai di qua complete()/reopen()/archive() ben duoi (co day du 3 dieu kien
    // tren).
    // 26/10/2026: lead quyet dinh quyen xem tai lieu du an (Document Service) - doi lead thi ghi
    // PROJECT_LEAD_CHANGED trong CUNG transaction voi thay doi, cac truong khac giu nguyen duong cu.
    const nextLeadUserId = project.leadUserId ?? null;
    if (nextLeadUserId === previousLeadUserId) return this.projectRepo.save(project);
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(project);
      const payload: ProjectLeadChangedPayload = { projectId: id, leadUserId: nextLeadUserId, previousLeadUserId, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.PROJECT_LEAD_CHANGED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });
      return saved;
    });
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
  async complete(organizationId: string, id: string, actorId: string, caller?: ScopeCaller): Promise<Project> {
    const existing = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });
    await this.assertCallerScope(organizationId, id, caller);
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

  async reopen(organizationId: string, id: string, actorId: string, caller?: ScopeCaller): Promise<Project> {
    const existing = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });
    await this.assertCallerScope(organizationId, id, caller);
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
  async archive(organizationId: string, id: string, actorId: string, caller?: ScopeCaller): Promise<Project> {
    const existing = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });
    await this.assertCallerScope(organizationId, id, caller);
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
  async remove(organizationId: string, actorId: string, id: string, caller?: ScopeCaller): Promise<void> {
    const existing = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });
    await this.assertCallerScope(organizationId, id, caller);

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

  /**
   * 17/09/2026: danh sach id du an ma 1 nguoi khong co PROJECT_CREATE (Employee) duoc phep thay -
   * dung cho findAll()/findById() o tren. Chua co bang "thanh vien du an" rieng nen suy tu 3 nguon:
   * (1) dang duoc giao >=1 Task thuoc du an do (TaskAssignee JOIN Task - dung LAI CHINH XAC kieu
   * join cua computeProjectStats() ben duoi, chi doi chieu theo userId thay vi theo projectId),
   * (2) la nguoi phu trach (leadUserId), (3) la nguoi tao (createdByUserId).
   *
   * `restrictToIds` (tuy chon) gioi han truy van trong 1 tap id cho truoc - dung boi findById()
   * (truyen [id]) de tranh quet toan bo du an nguoi dung co lien quan chi de kiem tra 1 id duy nhat,
   * mirror cach computeProjectStats() nhan mang id de tai su dung cho ca truong hop 1 phan tu.
   *
   * 22/09/2026: them nguon thu 4 - thanh vien du an "that" (ProjectMember, xem addMember() ben duoi),
   * doc lap voi TaskAssignee (mot nguoi co the duoc them vao du an TRUOC KHI duoc giao Task cu the
   * nao). Cung phai cap nhat GIONG HET logic nay tai TasksService.getVisibleProjectIds() (nhan ban
   * co y, xem chu thich tai do) de mot thanh vien du an (chua co Task nao) cung thay duoc du an cua
   * ho trong danh sach, dung tinh than "thanh vien du an -> thay duoc ca Task cua du an do".
   *
   * 26/10/2026: nhan 1 TAP userIds thay vi 1 userId - Manager truyen [chinh minh + thanh vien phong
   * ban] (xem resolveScopeUserIds()), Employee truyen [chinh minh]; 4 nguon lien quan giu nguyen.
   *
   * 26/10/2026: DINH NGHIA DUY NHAT "thuoc du an" = lead/thanh vien/nguoi tao ("du an lien quan phong ban"
   * = 1 trong 3 vai tro do thuoc phong ban) - CUNG quy tac voi tai lieu du an (Document Service, GRANTS_SQL).
   * Bo nguon TaskAssignee: giao Task gio tu them nguoi duoc giao lam thanh vien (TasksService.assign()),
   * du lieu cu da duoc scripts/migrate-project-documents.js chuyen nguoi duoc giao thanh thanh vien.
   */
  private async getVisibleProjectIds(
    organizationId: string,
    userIds: string[],
    restrictToIds?: string[],
  ): Promise<string[]> {
    if (restrictToIds && restrictToIds.length === 0) return [];

    const memberQuery = this.dataSource
      .getRepository(ProjectMember)
      .createQueryBuilder('member')
      .innerJoin(Project, 'project', 'project.id = member.projectId')
      .select('DISTINCT member.projectId', 'projectId')
      .where('member.userId IN (:...userIds)', { userIds })
      .andWhere('project.organizationId = :organizationId', { organizationId });
    if (restrictToIds) {
      memberQuery.andWhere('member.projectId IN (:...restrictToIds)', { restrictToIds });
    }
    const memberRows = await memberQuery.getRawMany<{ projectId: string }>();

    const ownedWhere: FindOptionsWhere<Project>[] = [
      { organizationId, leadUserId: In(userIds) },
      { organizationId, createdByUserId: In(userIds) },
    ];
    if (restrictToIds) {
      for (const clause of ownedWhere) clause.id = In(restrictToIds);
    }
    const ownedProjects = await this.projectRepo.find({ where: ownedWhere, select: ['id'] });

    const ids = new Set<string>();
    for (const row of memberRows) ids.add(row.projectId);
    for (const project of ownedProjects) ids.add(project.id);
    return Array.from(ids);
  }

  /**
   * 26/10/2026: chan doc 1 du an ngoai pham vi (findById()/listMembers()) - NotFoundException CUNG
   * errorCode voi "khong ton tai" de khong lo su ton tai cua du an (cung ly do 17/09/2026 o findById()).
   */
  private async assertProjectVisible(
    organizationId: string,
    projectId: string,
    userId: string,
    permissions: string[],
    departmentId: string | null,
  ): Promise<void> {
    const scopeUserIds = await resolveScopeUserIds(
      this.dataSource,
      organizationId,
      userId,
      permissions ?? [],
      PERMISSIONS.PROJECT_CREATE,
      departmentId,
    );
    if (!scopeUserIds) return;
    const visibleIds = await this.getVisibleProjectIds(organizationId, scopeUserIds, [projectId]);
    if (!visibleIds.includes(projectId)) {
      throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });
    }
  }

  /**
   * 26/10/2026: moi thao tac GHI theo id (sua/hoan thanh/mo lai/luu tru/xoa du an, them/go thanh vien)
   * cung phai nam trong pham vi xem. Truoc day Manager bi thu hep pham vi DOC nhung van ghi duoc vao
   * du an ngoai pham vi neu biet UUID - tu them minh lam thanh vien/lead la thay ngay du an va ca tai
   * lieu du an ben Document Service. `caller` undefined = goi noi bo, khong kiem tra.
   */
  private async assertCallerScope(organizationId: string, projectId: string, caller?: ScopeCaller): Promise<void> {
    if (caller) await this.assertProjectVisible(organizationId, projectId, caller.userId, caller.permissions, caller.departmentId);
  }

  /**
   * 22/09/2026: CRUD thanh vien du an (ProjectMember) - thay the co che gia lap hoan toan bang
   * localStorage o frontend (ProjectMembersModal.tsx/utils.ts) truoc day, khong luu server-side va
   * khong dong bo giua cac trinh duyet/thiet bi. Mirror dung pattern TasksService.assign()/unassign()
   * (bat QueryFailedError 23505 cho truong hop 2 request them dong thoi CUNG 1 nguoi).
   */
  // 26/10/2026: `caller` (tuy chon) - truoc day ai co PROJECT_VIEW cung doc duoc danh sach thanh vien
  // cua BAT KY du an nao neu biet UUID; nay ap dung cung pham vi xem voi findById().
  async listMembers(
    organizationId: string,
    projectId: string,
    caller?: ScopeCaller,
  ): Promise<ProjectMember[]> {
    await this.findProjectOrFail(organizationId, projectId);
    await this.assertCallerScope(organizationId, projectId, caller);
    return this.dataSource.getRepository(ProjectMember).find({ where: { projectId } });
  }

  async addMember(
    organizationId: string,
    projectId: string,
    actorId: string,
    userId: string,
    caller?: ScopeCaller,
  ): Promise<ProjectMember> {
    await this.findProjectOrFail(organizationId, projectId);
    await this.assertCallerScope(organizationId, projectId, caller);

    const memberRepo = this.dataSource.getRepository(ProjectMember);
    const existing = await memberRepo.findOne({ where: { projectId, userId } });
    if (existing) return existing;

    try {
      // 26/10/2026: ghi PROJECT_MEMBER_ADDED cung transaction - Document Service mo tai lieu du an
      // cho thanh vien moi qua read-model rieng (khong doc DB nay). Nhanh "da la thanh vien" o tren
      // va nhanh race 23505 ben duoi KHONG phat lai (khong co thay doi that).
      return await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(manager.create(ProjectMember, { projectId, userId, addedByUserId: actorId }));
        const payload: ProjectMemberAddedPayload = { projectId, userId, actorId };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.PROJECT_MEMBER_ADDED,
          organizationId,
          producer: PRODUCER,
          payload: payload as unknown as Record<string, unknown>,
        });
        return saved;
      });
    } catch (error) {
      const pgErrorCode =
        error instanceof QueryFailedError
          ? (error.driverError as { code?: string } | undefined)?.code
          : undefined;
      if (pgErrorCode === POSTGRES_UNIQUE_VIOLATION) {
        const race = await memberRepo.findOne({ where: { projectId, userId } });
        if (race) return race;
      }
      throw error;
    }
  }

  // 26/10/2026: them `actorId` cho su kien PROJECT_MEMBER_REMOVED (xem cuoi ham).
  async removeMember(organizationId: string, projectId: string, userId: string, actorId: string, caller?: ScopeCaller): Promise<void> {
    const project = await this.findProjectOrFail(organizationId, projectId);
    await this.assertCallerScope(organizationId, projectId, caller);
    if (project.leadUserId === userId) {
      throw new BadRequestException({
        message: 'Khong the go nguoi phu trach du an khoi danh sach thanh vien',
        errorCode: ERROR_CODES.PROJECT_MEMBER_IS_LEAD,
      });
    }

    const memberRepo = this.dataSource.getRepository(ProjectMember);
    const member = await memberRepo.findOne({ where: { projectId, userId } });
    if (!member) return;
    // 26/10/2026: thanh vien la nguon su that "thuoc du an" - go nguoi con Task chua xong (khac DONE) thi
    // ho mat quyen xem chinh Task do. Bat buoc giao lai Task truoc (409).
    const openTaskCount = await this.assigneeRepo
      .createQueryBuilder('assignee')
      .innerJoin(Task, 'task', 'task.id = assignee.taskId')
      .where('assignee.userId = :userId', { userId })
      .andWhere('task.projectId = :projectId', { projectId })
      .andWhere('task.status != :done', { done: TaskStatus.DONE })
      .getCount();
    if (openTaskCount > 0) {
      throw new ConflictException({
        message: 'Thanh vien con Task chua hoan thanh trong du an - hay giao lai cac Task do truoc khi go',
        errorCode: ERROR_CODES.PROJECT_MEMBER_HAS_OPEN_TASKS,
        errorParams: { count: openTaskCount },
      });
    }
    // 26/10/2026: go thanh vien = thu hoi quyen xem tai lieu du an ben Document Service - ghi
    // PROJECT_MEMBER_REMOVED cung transaction voi thao tac xoa.
    await this.dataSource.transaction(async (manager) => {
      await manager.remove(member);
      const payload: ProjectMemberRemovedPayload = { projectId, userId, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.PROJECT_MEMBER_REMOVED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });
    });
  }

  private async findProjectOrFail(organizationId: string, id: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id, organizationId } });
    if (!project) throw new NotFoundException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND });
    return project;
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
