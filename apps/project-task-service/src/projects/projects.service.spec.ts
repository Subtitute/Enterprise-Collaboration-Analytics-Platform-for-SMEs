import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EVENT_TYPES, PERMISSIONS, ProjectStatus } from '@app/common-dto';
import { ProjectsService } from './projects.service';

/**
 * 22/07/2026: Unit test cho cac loi race-condition MAJOR phat hien qua code review 22/07/2026
 * (mirror tasks.service.spec.ts - mock thu cong DataSource/Repository, khong boot NestJS module
 * hay DB that): ProjectsService.complete() (Fix 3) va ProjectsService.remove() (Fix 3 + Fix 4).
 */
describe('ProjectsService', () => {
  const organizationId = 'org-1';
  const projectId = 'project-1';
  const actorId = 'actor-1';

  describe('complete - fix race condition hoan thanh du an dong thoi (Fix 3)', () => {
    function createService(preCheckStatus: ProjectStatus, lockedStatus: ProjectStatus) {
      const lockedProject = { id: projectId, organizationId, status: lockedStatus };

      const managerMock = {
        findOne: jest.fn().mockResolvedValue(lockedProject),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const projectRepoMock = {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: projectId, organizationId, status: preCheckStatus }),
      };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        {} as any,
        {} as any,
        outboxServiceMock as any,
      );

      return { service, managerMock, outboxServiceMock };
    }

    it('tu choi (thua cuoc) neu row vua duoc khoa BEN TRONG transaction da bi 1 request khac hoan thanh truoc - chi 1 outbox event duy nhat toan cuc', async () => {
      // Pre-check (khong khoa): status ACTIVE -> khong fail-fast. Nhung giua luc pre-check va luc
      // khoa, 1 request khac da thang cuoc va commit COMPLETED truoc.
      const { service, managerMock, outboxServiceMock } = createService(
        ProjectStatus.ACTIVE,
        ProjectStatus.COMPLETED,
      );

      await expect(service.complete(organizationId, projectId, actorId)).rejects.toThrow(
        BadRequestException,
      );

      // Phai khoa row bang pessimistic_write truoc khi re-check.
      expect(managerMock.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      // Request thua cuoc KHONG duoc ghi de status/KHONG duoc ghi outbox -> tranh double-emit PROJECT_COMPLETED.
      expect(managerMock.save).not.toHaveBeenCalled();
      expect(outboxServiceMock.record).not.toHaveBeenCalled();
    });

    it('cho phep khi row vua khoa van chua hoan thanh - cap nhat status + ghi dung 1 Outbox event PROJECT_COMPLETED', async () => {
      const { service, managerMock, outboxServiceMock } = createService(
        ProjectStatus.ACTIVE,
        ProjectStatus.ACTIVE,
      );

      const updated = await service.complete(organizationId, projectId, actorId);

      expect(updated.status).toBe(ProjectStatus.COMPLETED);
      expect(managerMock.save).toHaveBeenCalledTimes(1);
      expect(outboxServiceMock.record).toHaveBeenCalledTimes(1);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({ eventType: EVENT_TYPES.PROJECT_COMPLETED }),
      );
    });
  });

  // 25/07/2026: bo sung test con thieu - archive() (them 22/07/2026, fix MINOR "hoan thien tinh
  // nang") mirror CHINH XAC pattern pessimistic_write + re-check cua complete() o tren nhung chua
  // tung duoc test. Diem khac biet can khoa rieng: archive() KHONG ghi Outbox event nao (chua co
  // EVENT_TYPES.PROJECT_ARCHIVED, xem chu thich tai ProjectsService.archive()).
  describe('archive - luu tru du an, mirror pattern pessimistic_write + re-check cua complete()', () => {
    function createService(preCheckStatus: ProjectStatus, lockedStatus: ProjectStatus) {
      const lockedProject = { id: projectId, organizationId, status: lockedStatus };

      const managerMock = {
        findOne: jest.fn().mockResolvedValue(lockedProject),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const projectRepoMock = {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: projectId, organizationId, status: preCheckStatus }),
      };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        {} as any,
        {} as any,
        outboxServiceMock as any,
      );

      return { service, managerMock, outboxServiceMock };
    }

    it('tu choi (thua cuoc) neu row vua duoc khoa BEN TRONG transaction da bi 1 request khac luu tru truoc', async () => {
      // Pre-check (khong khoa): status ACTIVE -> khong fail-fast. Nhung giua luc pre-check va luc
      // khoa, 1 request khac da thang cuoc va commit ARCHIVED truoc.
      const { service, managerMock, outboxServiceMock } = createService(
        ProjectStatus.ACTIVE,
        ProjectStatus.ARCHIVED,
      );

      await expect(service.archive(organizationId, projectId, actorId)).rejects.toThrow(
        BadRequestException,
      );

      expect(managerMock.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(managerMock.save).not.toHaveBeenCalled();
      expect(outboxServiceMock.record).not.toHaveBeenCalled();
    });

    it('cho phep khi row vua khoa van chua luu tru - cap nhat status ARCHIVED, KHONG ghi Outbox event nao (chua co EVENT_TYPES phu hop)', async () => {
      const { service, managerMock, outboxServiceMock } = createService(
        ProjectStatus.ACTIVE,
        ProjectStatus.ACTIVE,
      );

      const updated = await service.archive(organizationId, projectId, actorId);

      expect(updated.status).toBe(ProjectStatus.ARCHIVED);
      expect(managerMock.save).toHaveBeenCalledTimes(1);
      expect(outboxServiceMock.record).not.toHaveBeenCalled();
    });
  });

  describe('remove - fix idempotent xoa dong thoi (Fix 3) + phat task.deleted cho Task cascade (Fix 4)', () => {
    it('bo qua xoa va KHONG ghi Outbox neu row da bi 1 request dong thoi khac xoa truoc (DELETE idempotent)', async () => {
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn(),
        remove: jest.fn(),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const projectRepoMock = {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: projectId, organizationId, status: ProjectStatus.ACTIVE }),
      };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        {} as any,
        {} as any,
        outboxServiceMock as any,
      );

      await service.remove(organizationId, actorId, projectId);

      expect(managerMock.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(managerMock.remove).not.toHaveBeenCalled();
      expect(outboxServiceMock.record).not.toHaveBeenCalled();
    });

    it('ghi dung 1 event PROJECT_DELETED + 1 event TASK_DELETED cho MOI Task bi cascade xoa cung du an', async () => {
      const project = { id: projectId, organizationId, status: ProjectStatus.ACTIVE };
      const orphanedTasks = [{ id: 'task-1' }, { id: 'task-2' }];
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(project),
        find: jest.fn().mockResolvedValue(orphanedTasks),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const projectRepoMock = { findOne: jest.fn().mockResolvedValue(project) };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        {} as any,
        {} as any,
        outboxServiceMock as any,
      );

      await service.remove(organizationId, actorId, projectId);

      expect(managerMock.remove).toHaveBeenCalledTimes(1);
      // 1 PROJECT_DELETED + 2 TASK_DELETED (1 event / Task cascade-xoa cung du an).
      expect(outboxServiceMock.record).toHaveBeenCalledTimes(3);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({ eventType: EVENT_TYPES.PROJECT_DELETED }),
      );
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({
          eventType: EVENT_TYPES.TASK_DELETED,
          payload: expect.objectContaining({ taskId: 'task-1', projectId }),
        }),
      );
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({
          eventType: EVENT_TYPES.TASK_DELETED,
          payload: expect.objectContaining({ taskId: 'task-2', projectId }),
        }),
      );
    });
  });

  // 25/07/2026: bo sung test con thieu - findById() (fix code review 22/07/2026, loi MAJOR) phai
  // tra ve DUNG shape ProjectListItem (kem completionRate/memberCount) ma findAll() tra cho tung
  // phan tu trong danh sach, dung chung computeProjectStats(). Truoc ban sua nay chua co test nao
  // khoa lai hanh vi do rieng cho findById().
  describe('findById - shape enrich (completionRate/memberCount) phai khop findAll() qua computeProjectStats() dung chung', () => {
    /** QueryBuilder gia lap chain duoc (select/addSelect/where/andWhere/innerJoin/groupBy) roi tra ve rawResult o getRawMany(). */
    function makeQueryBuilder(rawResult: Array<{ projectId: string; count: string }>) {
      const qb: any = {};
      qb.select = jest.fn().mockReturnValue(qb);
      qb.addSelect = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.innerJoin = jest.fn().mockReturnValue(qb);
      qb.groupBy = jest.fn().mockReturnValue(qb);
      qb.getRawMany = jest.fn().mockResolvedValue(rawResult);
      return qb;
    }

    it('tra ve project kem completionRate/memberCount tinh tu computeProjectStats - dung field findAll() cung tra cho 1 du an', async () => {
      const project = { id: projectId, organizationId, name: 'Du an X', status: ProjectStatus.ACTIVE };
      const projectRepoMock = { findOne: jest.fn().mockResolvedValue(project) };

      // 3 Task, 2 DONE -> completionRate = round(2/3*100) = 67%; 2 nguoi phu trach duy nhat -> memberCount = 2.
      const taskRepoMock = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(makeQueryBuilder([{ projectId, count: '3' }])) // tong so Task
          .mockReturnValueOnce(makeQueryBuilder([{ projectId, count: '2' }])), // so Task DONE
      };
      const assigneeRepoMock = {
        createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([{ projectId, count: '2' }])),
      };

      const service = new ProjectsService(
        {} as any,
        projectRepoMock as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        {} as any,
      );

      // 17/09/2026: truyen permissions co PROJECT_CREATE (Manager/Org Admin) de bo qua scoping moi
      // them - test nay chi khoa lai shape enrich (completionRate/memberCount), khong lien quan
      // scoping (xem describe rieng "findAll/findById - scoping theo PROJECT_CREATE" ben duoi).
      const result = await service.findById(organizationId, projectId, 'caller-1', [
        PERMISSIONS.PROJECT_CREATE,
      ]);

      // Cung shape ProjectListItem ma findAll() tra: { ...project, completionRate, memberCount }.
      expect(result).toMatchObject({
        id: projectId,
        organizationId,
        name: 'Du an X',
        completionRate: 67,
        memberCount: 2,
      });
    });

    it('tra ve completionRate=0/memberCount=0 khi du an chua co Task/nguoi phu trach nao (khong co row aggregate)', async () => {
      const project = { id: projectId, organizationId, name: 'Du an moi', status: ProjectStatus.ACTIVE };
      const projectRepoMock = { findOne: jest.fn().mockResolvedValue(project) };
      const taskRepoMock = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(makeQueryBuilder([]))
          .mockReturnValueOnce(makeQueryBuilder([])),
      };
      const assigneeRepoMock = {
        createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])),
      };

      const service = new ProjectsService(
        {} as any,
        projectRepoMock as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        {} as any,
      );

      const result = await service.findById(organizationId, projectId, 'caller-1', [
        PERMISSIONS.PROJECT_CREATE,
      ]);

      expect(result).toMatchObject({ id: projectId, completionRate: 0, memberCount: 0 });
    });
  });

  /**
   * 17/09/2026: test cho tinh nang moi - Employee (co PROJECT_VIEW nhung KHONG co PROJECT_CREATE)
   * chi duoc thay du an minh dang duoc giao viec/la nguoi phu trach/nguoi tao, thay vi TOAN BO du an
   * cua to chuc nhu truoc. Manager/Org Admin (co PROJECT_CREATE) phai tiep tuc thay TAT CA, khong
   * doi hanh vi cu. Mock thu cong queryBuilder/Repository, cung phong cach voi cac describe khac
   * trong file nay (khong boot NestJS module hay DB that).
   */
  describe('findAll/findById - scoping theo PROJECT_CREATE (thay tat ca vs chi thay du an co lien quan)', () => {
    const employeeId = 'employee-1';
    const employeePermissions = [PERMISSIONS.PROJECT_VIEW];
    const managerPermissions = [PERMISSIONS.PROJECT_CREATE, PERMISSIONS.PROJECT_VIEW];

    /** QueryBuilder gia lap chain duoc (select/addSelect/where/andWhere/innerJoin/groupBy) roi tra ve rawResult o getRawMany(). */
    function makeQueryBuilder(rawResult: unknown[]) {
      const qb: any = {};
      qb.select = jest.fn().mockReturnValue(qb);
      qb.addSelect = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.innerJoin = jest.fn().mockReturnValue(qb);
      qb.groupBy = jest.fn().mockReturnValue(qb);
      qb.getRawMany = jest.fn().mockResolvedValue(rawResult);
      return qb;
    }

    /** Empty query builder dung cho cac lan goi computeProjectStats() ma test khong quan tam ket qua (mac dinh 0/0). */
    function emptyStatsRepos() {
      const taskRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) };
      return taskRepoMock;
    }

    it('Employee: findAll() chi tra ve du an duoc giao viec (TaskAssignee) HOAC la nguoi phu trach/nguoi tao - loai bo du an khong lien quan', async () => {
      const allProjects = [
        { id: 'project-1', organizationId, name: 'Duoc giao viec' },
        { id: 'project-2', organizationId, name: 'Khong lien quan' },
        { id: 'project-3', organizationId, name: 'Tu tao' },
      ];

      const projectRepoMock = {
        // getVisibleProjectIds(): du an 'project-3' la do employee tu tao/phu trach.
        find: jest.fn().mockResolvedValue([{ id: 'project-3' }]),
        findAndCount: jest.fn().mockImplementation((options: any) => {
          const idOperator = options.where.id;
          const filtered = idOperator
            ? allProjects.filter((p) => idOperator.value.includes(p.id))
            : allProjects;
          return Promise.resolve([filtered, filtered.length]);
        }),
      };
      const assigneeRepoMock = {
        createQueryBuilder: jest
          .fn()
          // Lan 1: getVisibleProjectIds() - employee dang duoc giao Task thuoc 'project-1'.
          .mockReturnValueOnce(makeQueryBuilder([{ projectId: 'project-1' }]))
          // Lan 2: computeProjectStats() memberRows - khong quan tam ket qua o test nay.
          .mockReturnValueOnce(makeQueryBuilder([])),
      };
      const taskRepoMock = emptyStatsRepos();

      // 22/09/2026: getVisibleProjectIds() gio truy van them ProjectMember qua
      // `this.dataSource.getRepository(ProjectMember)` - can mock getRepository() tra ve 1
      // queryBuilder rong (test nay khong lien quan ProjectMember, chi khoa lai TaskAssignee/lead/creator).
      const dataSourceMock = {
        getRepository: jest.fn().mockReturnValue({ createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) }),
      };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        {} as any,
      );

      const result = await service.findAll(
        organizationId,
        { page: 1, limit: 20 } as any,
        employeeId,
        employeePermissions,
      );

      // Chi con 'project-1' (duoc giao viec) va 'project-3' (tu tao) - 'project-2' bi loai vi
      // employee khong co lien quan gi (khong duoc giao Task, khong phai lead/nguoi tao).
      expect(result.data.map((p) => p.id).sort()).toEqual(['project-1', 'project-3']);
      expect(projectRepoMock.find).toHaveBeenCalledTimes(1);
    });

    it('Employee: findAll() tra ve danh sach rong (khong loi) neu khong lien quan bat ky du an nao', async () => {
      const projectRepoMock = {
        find: jest.fn().mockResolvedValue([]),
        findAndCount: jest.fn(),
      };
      const assigneeRepoMock = {
        createQueryBuilder: jest.fn().mockReturnValueOnce(makeQueryBuilder([])),
      };

      const dataSourceMock = {
        getRepository: jest.fn().mockReturnValue({ createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) }),
      };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        {} as any,
        assigneeRepoMock as any,
        {} as any,
      );

      const result = await service.findAll(
        organizationId,
        { page: 1, limit: 20 } as any,
        employeeId,
        employeePermissions,
      );

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      // Tra rong SOM ngay khi khong co du an nao lien quan - khong can query trang Project that su.
      expect(projectRepoMock.findAndCount).not.toHaveBeenCalled();
    });

    it('Manager (co PROJECT_CREATE): findAll() van tra ve TOAN BO du an cua to chuc - khong doi hanh vi cu', async () => {
      const allProjects = [
        { id: 'project-1', organizationId },
        { id: 'project-2', organizationId },
      ];
      const projectRepoMock = {
        find: jest.fn(),
        findAndCount: jest.fn().mockResolvedValue([allProjects, allProjects.length]),
      };
      const assigneeRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) };
      const taskRepoMock = emptyStatsRepos();

      const service = new ProjectsService(
        {} as any,
        projectRepoMock as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        {} as any,
      );

      const result = await service.findAll(
        organizationId,
        { page: 1, limit: 20 } as any,
        'manager-1',
        managerPermissions,
      );

      expect(result.data.map((p) => p.id)).toEqual(['project-1', 'project-2']);
      // Khong goi getVisibleProjectIds() (khong co lenh doc "du an minh phu trach/tao" nao) -
      // xac nhan hoan toan bo qua scoping cho Manager.
      expect(projectRepoMock.find).not.toHaveBeenCalled();
      expect(projectRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.not.objectContaining({ id: expect.anything() }) }),
      );
    });

    it('Employee: findById() nem NotFoundException (khong phai Forbidden) khi xem 1 du an ton tai nhung khong lien quan - tranh lo lieu ton tai', async () => {
      const project = { id: 'project-2', organizationId, name: 'Khong lien quan' };
      const projectRepoMock = {
        findOne: jest.fn().mockResolvedValue(project),
        // Khong phai lead/nguoi tao.
        find: jest.fn().mockResolvedValue([]),
      };
      const assigneeRepoMock = {
        // Khong duoc giao Task nao thuoc du an nay.
        createQueryBuilder: jest.fn().mockReturnValueOnce(makeQueryBuilder([])),
      };

      const dataSourceMock = {
        getRepository: jest.fn().mockReturnValue({ createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) }),
      };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        {} as any,
        assigneeRepoMock as any,
        {} as any,
      );

      await expect(
        service.findById(organizationId, 'project-2', employeeId, employeePermissions),
      ).rejects.toThrow(NotFoundException);
    });

    it('Employee: findById() cho xem binh thuong 1 du an ma minh la nguoi tao (createdByUserId)', async () => {
      const project = { id: 'project-3', organizationId, name: 'Tu tao' };
      const projectRepoMock = {
        findOne: jest.fn().mockResolvedValue(project),
        find: jest.fn().mockResolvedValue([{ id: 'project-3' }]),
      };
      const assigneeRepoMock = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(makeQueryBuilder([])) // getVisibleProjectIds: khong co Task nao duoc giao
          .mockReturnValueOnce(makeQueryBuilder([])), // computeProjectStats memberRows
      };
      const taskRepoMock = emptyStatsRepos();

      const dataSourceMock = {
        getRepository: jest.fn().mockReturnValue({ createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) }),
      };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        {} as any,
      );

      const result = await service.findById(
        organizationId,
        'project-3',
        employeeId,
        employeePermissions,
      );

      expect(result).toMatchObject({ id: 'project-3' });
    });
  });

  /**
   * 22/09/2026: test cho ProjectMember - thanh vien du an "that" (thay the co che gia lap bang
   * localStorage o frontend truoc day). Mirror phong cach mock cua TasksService.assign() (bat
   * QueryFailedError 23505 cho truong hop dua idempotent).
   */
  describe('addMember/removeMember/listMembers - ProjectMember', () => {
    const userId = 'user-1';

    it('addMember: tao moi thanh vien khi chua ton tai', async () => {
      const projectRepoMock = {
        findOne: jest.fn().mockResolvedValue({ id: projectId, organizationId, leadUserId: 'lead-1' }),
      };
      const memberRepoMock = {
        findOne: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockImplementation((data) => data),
        save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'member-1', ...data })),
      };
      const dataSourceMock = { getRepository: jest.fn().mockReturnValue(memberRepoMock) };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await service.addMember(organizationId, projectId, actorId, userId);

      expect(result).toMatchObject({ projectId, userId, addedByUserId: actorId });
      expect(memberRepoMock.save).toHaveBeenCalledTimes(1);
    });

    it('addMember: idempotent - tra ve ban ghi da co san neu da la thanh vien, khong tao trung', async () => {
      const existingMember = { id: 'member-1', projectId, userId, addedByUserId: 'someone-else' };
      const projectRepoMock = {
        findOne: jest.fn().mockResolvedValue({ id: projectId, organizationId, leadUserId: 'lead-1' }),
      };
      const memberRepoMock = {
        findOne: jest.fn().mockResolvedValue(existingMember),
        create: jest.fn(),
        save: jest.fn(),
      };
      const dataSourceMock = { getRepository: jest.fn().mockReturnValue(memberRepoMock) };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await service.addMember(organizationId, projectId, actorId, userId);

      expect(result).toBe(existingMember);
      expect(memberRepoMock.save).not.toHaveBeenCalled();
    });

    it('addMember: nem NotFoundException khi du an khong ton tai trong to chuc cua nguoi goi', async () => {
      const projectRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const service = new ProjectsService(
        { getRepository: jest.fn() } as any,
        projectRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await expect(service.addMember(organizationId, projectId, actorId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('removeMember: go thanh vien binh thuong khi khong phai nguoi phu trach du an', async () => {
      const existingMember = { id: 'member-1', projectId, userId };
      const projectRepoMock = {
        findOne: jest.fn().mockResolvedValue({ id: projectId, organizationId, leadUserId: 'lead-1' }),
      };
      const memberRepoMock = {
        findOne: jest.fn().mockResolvedValue(existingMember),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      const dataSourceMock = { getRepository: jest.fn().mockReturnValue(memberRepoMock) };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await service.removeMember(organizationId, projectId, userId);

      expect(memberRepoMock.remove).toHaveBeenCalledWith(existingMember);
    });

    it('removeMember: tu choi go nguoi dang la nguoi phu trach du an (leadUserId)', async () => {
      const projectRepoMock = {
        findOne: jest.fn().mockResolvedValue({ id: projectId, organizationId, leadUserId: userId }),
      };
      const memberRepoMock = { findOne: jest.fn(), remove: jest.fn() };
      const dataSourceMock = { getRepository: jest.fn().mockReturnValue(memberRepoMock) };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await expect(service.removeMember(organizationId, projectId, userId)).rejects.toThrow(
        BadRequestException,
      );
      expect(memberRepoMock.remove).not.toHaveBeenCalled();
    });
  });

  /**
   * 22/09/2026: Employee thay du an ma minh CHI la thanh vien duoc them qua ProjectMember (chua
   * duoc giao Task nao, khong phai lead/nguoi tao) - nguon visibility thu 4 vua them vao
   * getVisibleProjectIds().
   */
  describe('findAll - scoping: ProjectMember la nguon visibility doc lap voi TaskAssignee', () => {
    function makeQueryBuilder(rawResult: unknown[]) {
      const qb: any = {};
      qb.select = jest.fn().mockReturnValue(qb);
      qb.addSelect = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.innerJoin = jest.fn().mockReturnValue(qb);
      qb.groupBy = jest.fn().mockReturnValue(qb);
      qb.getRawMany = jest.fn().mockResolvedValue(rawResult);
      return qb;
    }

    it('Employee: thay du an ma minh la thanh vien (ProjectMember) du chua duoc giao Task nao', async () => {
      const employeeId = 'employee-2';
      const allProjects = [{ id: 'project-9', organizationId, name: 'Chi la thanh vien' }];
      const projectRepoMock = {
        find: jest.fn().mockResolvedValue([]), // khong phai lead/nguoi tao
        findAndCount: jest.fn().mockResolvedValue([allProjects, allProjects.length]),
      };
      const assigneeRepoMock = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(makeQueryBuilder([])) // getVisibleProjectIds: khong duoc giao Task nao
          .mockReturnValueOnce(makeQueryBuilder([])), // computeProjectStats memberRows
      };
      const memberRepoMock = {
        createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([{ projectId: 'project-9' }])),
      };
      const taskRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) };
      const dataSourceMock = { getRepository: jest.fn().mockReturnValue(memberRepoMock) };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        taskRepoMock as any,
        assigneeRepoMock as any,
        {} as any,
      );

      const result = await service.findAll(
        organizationId,
        { page: 1, limit: 20 } as any,
        employeeId,
        [PERMISSIONS.PROJECT_VIEW],
      );

      expect(result.data.map((p) => p.id)).toEqual(['project-9']);
    });
  });
});
