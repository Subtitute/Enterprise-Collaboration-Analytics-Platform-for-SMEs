import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
// 25/07/2026: them EVENT_TYPES - can cho assertion outbox trong test remove() bo sung ben duoi.
// 17/09/2026: them PERMISSIONS - can cho cac test scoping findAll()/findById() theo TASK_DELETE
// (xem describe "findAll/findById - scoping theo TASK_DELETE" o cuoi file).
import { EVENT_TYPES, PERMISSIONS, TaskStatus } from '@app/common-dto';
import { TasksService } from './tasks.service';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
// 26/10/2026: read-model thanh vien phong ban (pham vi xem cua Manager).
import { DimUser } from '../entities/dim-user.entity';

/**
 * Unit test cho 2 loi race-condition phat hien qua code review 21/07/2026
 * (Technical_Spec.md muc 3.3, muc 6): TasksService.updateStatus() va TasksService.assign().
 * Mock thu cong DataSource/Repository (tuong tu apps/iam-service/src/roles/permissions.guard.spec.ts)
 * de test duoc logic service ma khong can boot NestJS module hay DB that.
 */
describe('TasksService', () => {
  const organizationId = 'org-1';
  const taskId = 'task-1';
  const actorId = 'actor-1';

  /**
   * 22/07/2026: test bo sung cho fix code review loi CRITICAL - findAll() truoc day khong nap
   * quan he `assignees` (khong eager tren entity Task) nen Kanban board va modal chi tiet Task
   * luon nhan `task.assignees === undefined`. Xem TasksService.findAll()/loadAssigneesByTaskIds().
   */
  describe('findAll - fix code review 22/07/2026 (assignees luon bi thieu)', () => {
    it('gan dung assignees cho tung task qua 1 truy van gop TaskAssignee WHERE taskId IN (...), khong con undefined', async () => {
      const tasks = [
        { id: 'task-1', organizationId, projectId: 'p1', title: 'A', status: TaskStatus.TODO },
        { id: 'task-2', organizationId, projectId: 'p1', title: 'B', status: TaskStatus.TODO },
      ];
      const taskRepoMock = {
        findAndCount: jest.fn().mockResolvedValue([tasks, 2]),
      };
      // task-1 co 2 nguoi phu trach, task-2 khong ai ca - mo phong ket qua 1 truy van gop duy nhat.
      const assigneeRows = [
        { taskId: 'task-1', userId: 'user-1' },
        { taskId: 'task-1', userId: 'user-2' },
      ];
      const assigneeRepoMock = { find: jest.fn().mockResolvedValue(assigneeRows) };

      const service = new TasksService(
        {} as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
      );

      // 17/09/2026: truyen permissions co TASK_DELETE (Manager/Org Admin) de bo qua scoping moi them
      // - test nay chi khoa lai enrich assignees, khong lien quan scoping (xem describe rieng
      // "findAll/findById - scoping theo TASK_DELETE" o cuoi file).
      // 26/10/2026: chi Org Admin (USER_MANAGE) moi con bo qua scoping - Manager nay theo phong ban.
      const result = await service.findAll(
        organizationId,
        { page: 1, limit: 20 } as any,
        'admin-1',
        [PERMISSIONS.USER_MANAGE, PERMISSIONS.TASK_DELETE],
      );

      expect(result.data[0].assignees).toEqual([{ userId: 'user-1' }, { userId: 'user-2' }]);
      expect(result.data[1].assignees).toEqual([]);
      // Chi 1 lan goi assigneeRepo.find cho CA TRANG (batch), khong phai N+1 (1 lan/task).
      expect(assigneeRepoMock.find).toHaveBeenCalledTimes(1);
    });

    it('khong goi assigneeRepo.find neu trang khong co task nao (tranh IN () rong gay loi SQL)', async () => {
      const taskRepoMock = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
      const assigneeRepoMock = { find: jest.fn() };

      const service = new TasksService(
        {} as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
      );

      // 26/10/2026: Org Admin (USER_MANAGE) - xem ghi chu o test tren.
      const result = await service.findAll(organizationId, { page: 1, limit: 20 } as any, 'admin-1', [
        PERMISSIONS.USER_MANAGE,
        PERMISSIONS.TASK_DELETE,
      ]);

      expect(result.data).toEqual([]);
      expect(assigneeRepoMock.find).not.toHaveBeenCalled();
    });
  });

  /**
   * 22/07/2026: truoc ban sua, findById() tra ve field `assigneeIds: string[]` trong khi findAll()
   * (sau fix o tren) tra `assignees: { userId }[]` - 2 endpoint lech shape dan den frontend (dung
   * chung 1 kieu Task) khong the doc dung ca 2 noi. Test nay khoa lai field name + shape dung.
   */
  describe('findById - fix code review 22/07/2026 (dong bo shape assignees voi findAll)', () => {
    it('tra ve field `assignees: { userId }[]`, khong con `assigneeIds: string[]`', async () => {
      const taskRepoMock = {
        findOne: jest.fn().mockResolvedValue({ id: taskId, organizationId, projectId: 'p1', status: TaskStatus.TODO }),
      };
      const assigneeRepoMock = {
        find: jest.fn().mockResolvedValue([{ taskId, userId: 'user-1' }]),
      };
      const commentRepoMock = { count: jest.fn().mockResolvedValue(3) };

      const service = new TasksService(
        {} as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        commentRepoMock as any,
        {} as any,
        {} as any,
      );

      // 17/09/2026: cung ly do voi findAll() o tren - truyen permissions co TASK_DELETE de bo qua scoping.
      // 26/10/2026: Org Admin (USER_MANAGE) moi bo qua scoping.
      const result = await service.findById(organizationId, taskId, 'admin-1', [
        PERMISSIONS.USER_MANAGE,
        PERMISSIONS.TASK_DELETE,
      ]);

      expect(result.assignees).toEqual([{ userId: 'user-1' }]);
      expect((result as any).assigneeIds).toBeUndefined();
      expect(result.commentCount).toBe(3);
    });
  });

  describe('updateStatus - fix race condition keo-tha dong thoi', () => {
    function createService(preCheckStatus: TaskStatus, lockedStatus: TaskStatus) {
      const lockedTask = { id: taskId, organizationId, status: lockedStatus, projectId: 'p1' };

      const managerMock = {
        findOneOrFail: jest.fn().mockResolvedValue(lockedTask),
        // 22/09/2026: updateStatus() gio doc them Project (leadUserId) trong CUNG transaction de
        // dinh kem vao TaskStatusChangedPayload - tra null (khong co nguoi phu trach) o day, khong
        // anh huong ket qua cac test nay (chi khoa lai hanh vi status/race-condition).
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
        create: jest.fn().mockImplementation((_entityClass: unknown, data: unknown) => data),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const taskRepoMock = {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: taskId, organizationId, status: preCheckStatus, projectId: 'p1' }),
      };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new TasksService(
        dataSourceMock as any,
        taskRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
        outboxServiceMock as any,
      );

      return { service, managerMock, outboxServiceMock };
    }

    it('tu choi neu row vua duoc khoa BEN TRONG transaction da doi trang thai (stale pre-check khong con dung)', async () => {
      // Pre-check: snapshot cu la DOING -> DONE hop le. Nhung giua luc pre-check va luc lock,
      // 1 request khac da doi row that su thanh TODO -> DONE tu TODO la KHONG hop le.
      const { service, managerMock } = createService(TaskStatus.DOING, TaskStatus.TODO);
      const dto: UpdateTaskStatusDto = { status: TaskStatus.DONE };

      await expect(service.updateStatus(organizationId, taskId, actorId, dto)).rejects.toThrow(
        BadRequestException,
      );

      // Phai khoa row bang pessimistic_write truoc khi re-validate.
      expect(managerMock.findOneOrFail).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      // Khong duoc ap dung status moi khi re-check that bai.
      expect(managerMock.save).not.toHaveBeenCalled();
    });

    it('cho phep khi row vua khoa van con hop le - cap nhat Task + ghi TaskStatusHistory + Outbox cung transaction', async () => {
      const { service, managerMock, outboxServiceMock } = createService(
        TaskStatus.DOING,
        TaskStatus.DOING,
      );
      const dto: UpdateTaskStatusDto = { status: TaskStatus.DONE };

      const updated = await service.updateStatus(organizationId, taskId, actorId, dto);

      expect(updated.status).toBe(TaskStatus.DONE);
      // 1 lan save Task + 1 lan save TaskStatusHistory.
      expect(managerMock.save).toHaveBeenCalledTimes(2);
      expect(outboxServiceMock.record).toHaveBeenCalledTimes(1);
    });
  });

  // 25/07/2026: bo sung test con thieu cho remove() - ham nay dung pattern pessimistic-write-lock
  // + xoa idempotent (fix code review 22/07/2026, xem chu thich tai TasksService.remove()) nhung
  // truoc ban sua nay CHUA co unit test nao, mirror cach ProjectsService.remove() da duoc test.
  describe('remove - pessimistic write lock + xoa idempotent (mirror ProjectsService.remove())', () => {
    it('xoa thanh cong: khoa row bang pessimistic_write, remove() + ghi dung 1 event TASK_DELETED trong cung transaction', async () => {
      const task = { id: taskId, organizationId, projectId: 'p1' };
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(task),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const taskRepoMock = { findOne: jest.fn().mockResolvedValue(task) };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new TasksService(
        dataSourceMock as any,
        taskRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
        outboxServiceMock as any,
      );

      await expect(service.remove(organizationId, actorId, taskId)).resolves.toBeUndefined();

      expect(managerMock.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(managerMock.remove).toHaveBeenCalledTimes(1);
      expect(outboxServiceMock.record).toHaveBeenCalledTimes(1);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({
          eventType: EVENT_TYPES.TASK_DELETED,
          payload: expect.objectContaining({ taskId, projectId: 'p1', actorId }),
        }),
      );
    });

    it('goi remove() tren id da bi xoa truoc do khong nem loi (idempotent) - khong remove() lai, khong ghi outbox lai', async () => {
      const task = { id: taskId, organizationId, projectId: 'p1' };
      const managerMock = {
        // Row da bi 1 request dong thoi khac xoa mat giua luc pre-check va luc khoa.
        findOne: jest.fn().mockResolvedValue(null),
        remove: jest.fn(),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      // Pre-check (khong khoa, dau ham) van thay task ton tai tai thoi diem do.
      const taskRepoMock = { findOne: jest.fn().mockResolvedValue(task) };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new TasksService(
        dataSourceMock as any,
        taskRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
        outboxServiceMock as any,
      );

      await expect(service.remove(organizationId, actorId, taskId)).resolves.toBeUndefined();

      expect(managerMock.remove).not.toHaveBeenCalled();
      expect(outboxServiceMock.record).not.toHaveBeenCalled();
    });
  });

  describe('assign - fix xu ly xung dot unique constraint (23505) khi gan dong thoi', () => {
    function createService(assigneeFindOneMock: jest.Mock, saveRejection: Error) {
      const managerMock = {
        save: jest.fn().mockRejectedValue(saveRejection),
        create: jest.fn().mockImplementation((_entityClass: unknown, data: unknown) => data),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const taskRepoMock = {
        findOne: jest.fn().mockResolvedValue({ id: taskId, organizationId, projectId: 'p1' }),
      };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new TasksService(
        dataSourceMock as any,
        taskRepoMock as any,
        { findOne: assigneeFindOneMock } as any,
        {} as any,
        {} as any,
        outboxServiceMock as any,
      );

      return { service, managerMock };
    }

    it('tra ve ban ghi da ton tai thay vi de loi 500 bubble len khi 2 request dong thoi cung insert', async () => {
      const existingAssignee = { taskId, userId: 'user-1' };
      const uniqueViolation = new QueryFailedError(
        'INSERT INTO task_assignees ...',
        [],
        { name: 'error', message: 'duplicate key value violates unique constraint', code: '23505' } as any,
      );

      const assigneeFindOneMock = jest
        .fn()
        .mockResolvedValueOnce(undefined) // pre-check: chua thay ban ghi -> tien hanh insert
        .mockResolvedValueOnce(existingAssignee); // sau khi bat 23505: fetch lai, request thang cuoc da tao xong

      const { service } = createService(assigneeFindOneMock, uniqueViolation);

      const result = await service.assign(organizationId, taskId, actorId, 'user-1');

      expect(result).toBe(existingAssignee);
      expect(assigneeFindOneMock).toHaveBeenCalledTimes(2);
    });

    it('van nem lai loi neu la loi DB khac, khong phai vi pham unique constraint 23505', async () => {
      const otherError = new Error('connection lost');
      const assigneeFindOneMock = jest.fn().mockResolvedValueOnce(undefined);

      const { service } = createService(assigneeFindOneMock, otherError);

      await expect(service.assign(organizationId, taskId, actorId, 'user-1')).rejects.toThrow(
        'connection lost',
      );
    });

    // 26/10/2026: nguoi duoc giao Task thanh thanh vien du an (neu chua) trong CUNG transaction, va chi phat
    // project.member_added khi THAT SU them moi (ON CONFLICT DO NOTHING tra ve raw rong neu da la thanh vien).
    function createAssignService(insertedRaw: unknown[]) {
      const values = jest.fn().mockReturnThis();
      const insertQb = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values,
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: insertedRaw }),
      };
      const managerMock = {
        create: jest.fn((_entity: unknown, data: unknown) => data),
        save: jest.fn((data: unknown) => Promise.resolve(data)),
        createQueryBuilder: jest.fn().mockReturnValue(insertQb),
      };
      const outboxRecord = jest.fn();
      const service = new TasksService(
        { transaction: jest.fn((cb: (m: unknown) => unknown) => cb(managerMock)) } as any,
        { findOne: jest.fn().mockResolvedValue({ id: taskId, organizationId, projectId: 'project-1' }) } as any,
        { findOne: jest.fn().mockResolvedValue(null) } as any,
        {} as any,
        {} as any,
        { record: outboxRecord } as any,
      );
      return { service, values, outboxRecord };
    }

    it('giao Task cho nguoi CHUA la thanh vien -> them ProjectMember + phat project.member_added', async () => {
      const { service, values, outboxRecord } = createAssignService([{ id: 'member-1' }]);
      await service.assign(organizationId, taskId, actorId, 'user-1');

      expect(values).toHaveBeenCalledWith({ projectId: 'project-1', userId: 'user-1', addedByUserId: actorId });
      expect(outboxRecord.mock.calls.map((call) => call[1].eventType)).toEqual([EVENT_TYPES.TASK_ASSIGNED, EVENT_TYPES.PROJECT_MEMBER_ADDED]);
      expect(outboxRecord.mock.calls[1][1].payload).toEqual({ projectId: 'project-1', userId: 'user-1', actorId });
    });

    it('giao Task cho nguoi DA la thanh vien -> khong phat project.member_added', async () => {
      const { service, outboxRecord } = createAssignService([]);
      await service.assign(organizationId, taskId, actorId, 'user-1');

      expect(outboxRecord.mock.calls.map((call) => call[1].eventType)).toEqual([EVENT_TYPES.TASK_ASSIGNED]);
    });
  });

  /**
   * 17/09/2026: test cho tinh nang moi - Employee (co TASK_VIEW/TASK_CREATE/TASK_UPDATE nhung KHONG
   * co TASK_DELETE) chi duoc thay Task thuoc du an minh dang duoc giao viec/la nguoi phu trach/nguoi
   * tao, thay vi TOAN BO Task cua to chuc nhu truoc (mirror describe tuong tu trong
   * projects.service.spec.ts). Manager/Org Admin (co TASK_DELETE) phai tiep tuc thay TAT CA, khong
   * doi hanh vi cu.
   */
  describe('findAll/findById - scoping theo TASK_DELETE (thay tat ca vs chi thay Task cua du an co lien quan)', () => {
    const employeeId = 'employee-1';
    const employeePermissions = [PERMISSIONS.TASK_VIEW, PERMISSIONS.TASK_CREATE, PERMISSIONS.TASK_UPDATE];
    const managerPermissions = [PERMISSIONS.TASK_DELETE, PERMISSIONS.TASK_VIEW];

    /** QueryBuilder gia lap chain duoc (select/where/andWhere/innerJoin) roi tra ve rawResult o getRawMany(). */
    function makeQueryBuilder(rawResult: unknown[]) {
      const qb: any = {};
      qb.select = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.innerJoin = jest.fn().mockReturnValue(qb);
      qb.getRawMany = jest.fn().mockResolvedValue(rawResult);
      return qb;
    }

    // 26/10/2026: "thuoc du an" = lead/thanh vien/nguoi tao - TaskAssignee khong con la nguon rieng (giao Task tu them thanh vien).
    it('Employee: findAll() chi tra ve Task thuoc du an minh la thanh vien HOAC phu trach/nguoi tao - loai bo Task cua du an khong lien quan', async () => {
      const allTasks = [
        { id: 'task-1', organizationId, projectId: 'project-1', title: 'A' },
        { id: 'task-2', organizationId, projectId: 'project-2', title: 'B (khong lien quan)' },
        { id: 'task-3', organizationId, projectId: 'project-3', title: 'C (tu tao du an)' },
      ];
      const taskRepoMock = {
        findAndCount: jest.fn().mockImplementation((options: any) => {
          const projectIdOperator = options.where.projectId;
          const filtered = projectIdOperator
            ? allTasks.filter((t) => projectIdOperator.value.includes(t.projectId))
            : allTasks;
          return Promise.resolve([filtered, filtered.length]);
        }),
      };
      // 22/09/2026: dataSourceMock.getRepository() tra CUNG 1 mock nay cho ca Project (owned) lan
      // ProjectMember (getVisibleProjectIds() gio truy van ca 2) - them createQueryBuilder() rong de
      // nhanh ProjectMember khong lam vo hieu test (test nay chi khoa lai TaskAssignee/lead/creator).
      const projectOwnedRepoMock = {
        find: jest.fn().mockResolvedValue([{ id: 'project-3' }]),
        // getVisibleProjectIds(): employee la thanh vien (ProjectMember) cua 'project-1'.
        createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([{ projectId: 'project-1' }])),
      };
      const assigneeRepoMock = {
        createQueryBuilder: jest.fn(),
        find: jest.fn().mockResolvedValue([]), // enrich assignees - khong quan tam o test nay
      };
      const dataSourceMock = { getRepository: jest.fn().mockReturnValue(projectOwnedRepoMock) };

      const service = new TasksService(
        dataSourceMock as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await service.findAll(
        organizationId,
        { page: 1, limit: 20 } as any,
        employeeId,
        employeePermissions,
      );

      // Chi con 'task-1' (thuoc du an duoc giao viec) va 'task-3' (thuoc du an tu tao) -
      // 'task-2' bi loai vi employee khong lien quan gi den 'project-2'.
      expect(result.data.map((t) => t.id).sort()).toEqual(['task-1', 'task-3']);
      expect(dataSourceMock.getRepository).toHaveBeenCalledWith(expect.anything());
      expect(assigneeRepoMock.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('Employee: tu loc theo query.projectId cua 1 du an KHONG lien quan - tra ve rong thay vi bo qua scoping', async () => {
      const taskRepoMock = { findAndCount: jest.fn() };
      const projectOwnedRepoMock = {
        find: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])),
      };
      const assigneeRepoMock = {
        createQueryBuilder: jest.fn().mockReturnValueOnce(makeQueryBuilder([])), // khong duoc giao Task nao
      };
      const dataSourceMock = { getRepository: jest.fn().mockReturnValue(projectOwnedRepoMock) };

      const service = new TasksService(
        dataSourceMock as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await service.findAll(
        organizationId,
        { page: 1, limit: 20, projectId: 'project-2' } as any,
        employeeId,
        employeePermissions,
      );

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      // Khong duoc am tham bo qua bo loc projectId ma client tu chon - phai tra rong ngay, khong
      // cham toi DB Task that su.
      expect(taskRepoMock.findAndCount).not.toHaveBeenCalled();
    });

    // 26/10/2026: chi Org Admin (USER_MANAGE) con thay TOAN BO Task - Manager theo phong ban (test ben duoi).
    it('Org Admin (co USER_MANAGE): findAll() van tra ve TOAN BO Task cua to chuc - khong doi hanh vi cu', async () => {
      const allTasks = [
        { id: 'task-1', organizationId, projectId: 'project-1' },
        { id: 'task-2', organizationId, projectId: 'project-2' },
      ];
      const taskRepoMock = { findAndCount: jest.fn().mockResolvedValue([allTasks, allTasks.length]) };
      const assigneeRepoMock = { find: jest.fn().mockResolvedValue([]) };
      const dataSourceMock = { getRepository: jest.fn() };

      const service = new TasksService(
        dataSourceMock as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await service.findAll(
        organizationId,
        { page: 1, limit: 20 } as any,
        'admin-1',
        [PERMISSIONS.USER_MANAGE, ...managerPermissions],
      );

      expect(result.data.map((t) => t.id)).toEqual(['task-1', 'task-2']);
      // Khong goi getVisibleProjectIds() (khong doc Project nao) - xac nhan hoan toan bo qua scoping cho Org Admin.
      expect(dataSourceMock.getRepository).not.toHaveBeenCalled();
      expect(taskRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.not.objectContaining({ projectId: expect.anything() }) }),
      );
    });

    it('Employee: findById() nem NotFoundException (khong phai Forbidden) khi xem 1 Task ton tai nhung thuoc du an khong lien quan - tranh lo lieu ton tai', async () => {
      const task = { id: 'task-2', organizationId, projectId: 'project-2', title: 'B' };
      const taskRepoMock = { findOne: jest.fn().mockResolvedValue(task) };
      const projectOwnedRepoMock = {
        find: jest.fn().mockResolvedValue([]),
        createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])),
      };
      const assigneeRepoMock = {
        createQueryBuilder: jest.fn().mockReturnValueOnce(makeQueryBuilder([])),
      };
      const dataSourceMock = { getRepository: jest.fn().mockReturnValue(projectOwnedRepoMock) };

      const service = new TasksService(
        dataSourceMock as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await expect(
        service.findById(organizationId, 'task-2', employeeId, employeePermissions),
      ).rejects.toThrow(NotFoundException);
    });

    it('Employee: findById() cho xem binh thuong 1 Task thuoc du an ma minh la nguoi tao (createdByUserId)', async () => {
      const task = { id: 'task-3', organizationId, projectId: 'project-3', title: 'C' };
      const taskRepoMock = { findOne: jest.fn().mockResolvedValue(task) };
      // 22/09/2026: dataSourceMock.getRepository() tra CUNG 1 mock nay cho ca Project (owned) lan
      // ProjectMember (getVisibleProjectIds() gio truy van ca 2) - them createQueryBuilder() rong de
      // nhanh ProjectMember khong lam vo hieu test (test nay chi khoa lai TaskAssignee/lead/creator).
      const projectOwnedRepoMock = {
        find: jest.fn().mockResolvedValue([{ id: 'project-3' }]),
        createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])),
      };
      const assigneeRepoMock = {
        createQueryBuilder: jest.fn().mockReturnValueOnce(makeQueryBuilder([])),
        find: jest.fn().mockResolvedValue([]),
      };
      const commentRepoMock = { count: jest.fn().mockResolvedValue(0) };
      const dataSourceMock = { getRepository: jest.fn().mockReturnValue(projectOwnedRepoMock) };

      const service = new TasksService(
        dataSourceMock as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        commentRepoMock as any,
        {} as any,
        {} as any,
      );

      const result = await service.findById(
        organizationId,
        'task-3',
        employeeId,
        employeePermissions,
      );

      expect(result).toMatchObject({ id: 'task-3' });
    });

    /** 26/10/2026: getRepository() tra mock theo entity - DimUser (thanh vien phong ban) hoac Project/ProjectMember. */
    // 26/10/2026: them memberProjectIds - du an ma tap userIds la thanh vien (ProjectMember, nguon "thuoc du an").
    function scopedDataSource(departmentUserIds: string[], ownedProjectIds: string[], memberProjectIds: string[] = []) {
      const dimUserRepo = { find: jest.fn().mockResolvedValue(departmentUserIds.map((userId) => ({ userId }))) };
      const memberQb = makeQueryBuilder(memberProjectIds.map((projectId) => ({ projectId })));
      const projectRepo = {
        find: jest.fn().mockResolvedValue(ownedProjectIds.map((id) => ({ id }))),
        createQueryBuilder: jest.fn().mockReturnValue(memberQb),
      };
      return {
        dimUserRepo,
        memberQb,
        dataSource: { getRepository: jest.fn().mockImplementation((entity) => (entity === DimUser ? dimUserRepo : projectRepo)) },
      };
    }

    it('Manager co phong ban: findAll() chi tra Task cua du an lien quan toi chinh minh HOAC thanh vien phong ban', async () => {
      const allTasks = [
        { id: 'task-1', organizationId, projectId: 'project-dept' },
        { id: 'task-2', organizationId, projectId: 'project-other' },
      ];
      const taskRepoMock = {
        findAndCount: jest.fn().mockImplementation((options: any) => {
          const op = options.where.projectId;
          const filtered = op ? allTasks.filter((t) => op.value.includes(t.projectId)) : allTasks;
          return Promise.resolve([filtered, filtered.length]);
        }),
      };
      const assigneeRepoMock = { createQueryBuilder: jest.fn(), find: jest.fn().mockResolvedValue([]) };
      const { dataSource, dimUserRepo, memberQb } = scopedDataSource(['dept-member-1'], [], ['project-dept']);

      const service = new TasksService(dataSource as any, taskRepoMock as any, assigneeRepoMock as any, {} as any, {} as any, {} as any);
      const result = await service.findAll(organizationId, { page: 1, limit: 20 } as any, 'manager-1', managerPermissions, 'dept-1');

      expect(result.data.map((t) => t.id)).toEqual(['task-1']);
      expect(dimUserRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId, departmentId: 'dept-1' } }));
      expect(memberQb.where).toHaveBeenCalledWith('member.userId IN (:...userIds)', { userIds: ['manager-1', 'dept-member-1'] });
    });

    it('Manager chua duoc gan phong ban: chi con pham vi cua chinh minh (khong doc dim_user)', async () => {
      const taskRepoMock = { findAndCount: jest.fn() };
      const assigneeRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) };
      const { dataSource, dimUserRepo } = scopedDataSource(['dept-member-1'], []);

      const service = new TasksService(dataSource as any, taskRepoMock as any, assigneeRepoMock as any, {} as any, {} as any, {} as any);
      const result = await service.findAll(organizationId, { page: 1, limit: 20 } as any, 'manager-1', managerPermissions, null);

      expect(result.data).toEqual([]);
      expect(dimUserRepo.find).not.toHaveBeenCalled();
    });

    it('findStatusHistory()/findComments(): nem NotFoundException khi Task nam ngoai pham vi xem cua nguoi goi', async () => {
      const taskRepoMock = { findOne: jest.fn().mockResolvedValue({ id: 'task-2', organizationId, projectId: 'project-2' }) };
      const assigneeRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) };
      const { dataSource } = scopedDataSource([], []);
      const statusHistoryRepoMock = { findAndCount: jest.fn() };
      const commentRepoMock = { findAndCount: jest.fn() };

      const service = new TasksService(dataSource as any, taskRepoMock as any, assigneeRepoMock as any, commentRepoMock as any, statusHistoryRepoMock as any, {} as any);
      const caller = { userId: employeeId, permissions: employeePermissions, departmentId: 'dept-1' };

      await expect(service.findStatusHistory(organizationId, 'task-2', { page: 1, limit: 20 } as any, caller)).rejects.toThrow(NotFoundException);
      await expect(service.findComments(organizationId, 'task-2', { page: 1, limit: 20 } as any, caller)).rejects.toThrow(NotFoundException);
      expect(statusHistoryRepoMock.findAndCount).not.toHaveBeenCalled();
      expect(commentRepoMock.findAndCount).not.toHaveBeenCalled();
    });

    // 26/10/2026: thao tac GHI theo id cung theo pham vi xem - truoc day Employee sua/tu giao Task (hoac
    // tao Task trong du an) ngoai pham vi neu biet UUID, tu giao cho minh la "mo" luon du an do.
    it('create()/update()/assign()/addComment(): Task/du an ngoai pham vi -> NotFoundException, khong ghi gi', async () => {
      const taskRepoMock = { findOne: jest.fn().mockResolvedValue({ id: 'task-2', organizationId, projectId: 'project-2' }), save: jest.fn() };
      const assigneeRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])), findOne: jest.fn() };
      const commentRepoMock = { save: jest.fn(), create: jest.fn() };
      const { dataSource } = scopedDataSource([], []);
      const transaction = jest.fn();
      const service = new TasksService({ ...dataSource, transaction } as any, taskRepoMock as any, assigneeRepoMock as any, commentRepoMock as any, {} as any, {} as any);
      const caller = { userId: employeeId, permissions: employeePermissions, departmentId: 'dept-1' };

      await expect(service.create(organizationId, employeeId, { projectId: 'project-2', title: 'x' } as any, caller)).rejects.toThrow(NotFoundException);
      await expect(service.update(organizationId, 'task-2', { title: 'x' } as any, caller)).rejects.toThrow(NotFoundException);
      await expect(service.assign(organizationId, 'task-2', employeeId, employeeId, caller)).rejects.toThrow(NotFoundException);
      await expect(service.addComment(organizationId, 'task-2', employeeId, { content: 'x' } as any, caller)).rejects.toThrow(NotFoundException);
      expect(transaction).not.toHaveBeenCalled();
      expect(taskRepoMock.save).not.toHaveBeenCalled();
      expect(assigneeRepoMock.findOne).not.toHaveBeenCalled();
      expect(commentRepoMock.save).not.toHaveBeenCalled();
    });

    it('update(): Task trong du an nguoi goi la thanh vien -> ghi binh thuong', async () => {
      const task = { id: 'task-1', organizationId, projectId: 'project-1', title: 'A' };
      const taskRepoMock = { findOne: jest.fn().mockResolvedValue(task), save: jest.fn().mockImplementation((t) => Promise.resolve(t)) };
      const assigneeRepoMock = { createQueryBuilder: jest.fn() };
      const { dataSource } = scopedDataSource([], [], ['project-1']);
      const service = new TasksService(dataSource as any, taskRepoMock as any, assigneeRepoMock as any, {} as any, {} as any, {} as any);

      await service.update(organizationId, 'task-1', { title: 'B' } as any, { userId: employeeId, permissions: employeePermissions, departmentId: null });
      expect(taskRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'B' }));
    });
  });
});
