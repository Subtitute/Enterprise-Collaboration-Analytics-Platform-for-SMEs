import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ERROR_CODES, EVENT_TYPES, PERMISSIONS, ProjectStatus, TaskStatus } from '@app/common-dto';
import { ProjectsService } from './projects.service';
// 26/10/2026: read-model thanh vien phong ban (pham vi xem cua Manager).
import { DimUser } from '../entities/dim-user.entity';

// 26/10/2026: assigneeRepo gia cho dem Task chua xong cua thanh vien (removeMember()).
function openTasksRepo(count: number) {
  const qb: any = {};
  for (const fn of ['innerJoin', 'where', 'andWhere']) qb[fn] = jest.fn().mockReturnValue(qb);
  qb.getCount = jest.fn().mockResolvedValue(count);
  return { qb, createQueryBuilder: jest.fn().mockReturnValue(qb) };
}

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
      // 26/10/2026: chi Org Admin (USER_MANAGE) con bo qua scoping - Manager nay theo phong ban.
      const result = await service.findById(organizationId, projectId, 'caller-1', [
        PERMISSIONS.USER_MANAGE,
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

      // 26/10/2026: Org Admin (USER_MANAGE) - xem ghi chu o test tren.
      const result = await service.findById(organizationId, projectId, 'caller-1', [
        PERMISSIONS.USER_MANAGE,
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

    // 26/10/2026: "thuoc du an" = lead/thanh vien/nguoi tao - TaskAssignee khong con la nguon rieng (giao Task tu them thanh vien).
    it('Employee: findAll() chi tra ve du an minh la thanh vien HOAC phu trach/nguoi tao - loai bo du an khong lien quan', async () => {
      const allProjects = [
        { id: 'project-1', organizationId, name: 'Thanh vien' },
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
      // computeProjectStats() memberRows - khong quan tam ket qua o test nay.
      const assigneeRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) };
      const taskRepoMock = emptyStatsRepos();

      // getVisibleProjectIds(): employee la thanh vien (ProjectMember) cua 'project-1'.
      const dataSourceMock = {
        getRepository: jest.fn().mockReturnValue({ createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([{ projectId: 'project-1' }])) }),
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

      // Chi con 'project-1' (thanh vien) va 'project-3' (tu tao) - 'project-2' bi loai vi
      // employee khong co lien quan gi (khong phai thanh vien/lead/nguoi tao).
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

    // 26/10/2026: chi Org Admin (USER_MANAGE) con thay TOAN BO du an - Manager theo phong ban (test cuoi describe).
    it('Org Admin (co USER_MANAGE): findAll() van tra ve TOAN BO du an cua to chuc - khong doi hanh vi cu', async () => {
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
        'admin-1',
        [PERMISSIONS.USER_MANAGE, ...managerPermissions],
      );

      expect(result.data.map((p) => p.id)).toEqual(['project-1', 'project-2']);
      // Khong goi getVisibleProjectIds() (khong co lenh doc "du an minh phu trach/tao" nao) -
      // xac nhan hoan toan bo qua scoping cho Org Admin.
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

    // 26/10/2026: pham vi phong ban cua Manager - du an co lead/thanh vien/nguoi duoc giao Task thuoc
    // phong ban (thanh vien phong ban doc tu read-model dim_user) hien, du an khac bi loai.
    it('Manager co phong ban: findAll() tra du an co lead/thanh vien thuoc phong ban, loai du an phong ban khac', async () => {
      const allProjects = [
        { id: 'project-dept-lead', organizationId },
        { id: 'project-dept-member', organizationId },
        { id: 'project-other', organizationId },
      ];
      const projectRepoMock = {
        find: jest.fn().mockResolvedValue([{ id: 'project-dept-lead' }]),
        findAndCount: jest.fn().mockImplementation((options: any) => {
          const op = options.where.id;
          const filtered = op ? allProjects.filter((p) => op.value.includes(p.id)) : allProjects;
          return Promise.resolve([filtered, filtered.length]);
        }),
      };
      const assigneeRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) };
      const dimUserRepo = { find: jest.fn().mockResolvedValue([{ userId: 'dept-member-1' }]) };
      const memberQb = makeQueryBuilder([{ projectId: 'project-dept-member' }]);
      const memberRepo = { createQueryBuilder: jest.fn().mockReturnValue(memberQb) };
      const dataSourceMock = { getRepository: jest.fn().mockImplementation((entity) => (entity === DimUser ? dimUserRepo : memberRepo)) };

      const service = new ProjectsService(dataSourceMock as any, projectRepoMock as any, emptyStatsRepos() as any, assigneeRepoMock as any, {} as any);
      const result = await service.findAll(organizationId, { page: 1, limit: 20 } as any, 'manager-1', managerPermissions, 'dept-1');

      expect(result.data.map((p) => p.id).sort()).toEqual(['project-dept-lead', 'project-dept-member']);
      expect(memberQb.where).toHaveBeenCalledWith('member.userId IN (:...userIds)', { userIds: ['manager-1', 'dept-member-1'] });
      // 26/10/2026: lead/nguoi tao cung theo tap [minh + phong ban].
      expect(projectRepoMock.find).toHaveBeenCalledWith(expect.objectContaining({ where: [
        { organizationId, leadUserId: expect.objectContaining({ value: ['manager-1', 'dept-member-1'] }) },
        { organizationId, createdByUserId: expect.objectContaining({ value: ['manager-1', 'dept-member-1'] }) },
      ] }));
    });

    it('listMembers(): nem NotFoundException khi du an nam ngoai pham vi xem cua nguoi goi', async () => {
      const projectRepoMock = { findOne: jest.fn().mockResolvedValue({ id: 'project-2', organizationId }), find: jest.fn().mockResolvedValue([]) };
      const assigneeRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) };
      const memberFind = jest.fn();
      const dataSourceMock = {
        getRepository: jest.fn().mockReturnValue({ createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])), find: memberFind }),
      };

      const service = new ProjectsService(dataSourceMock as any, projectRepoMock as any, {} as any, assigneeRepoMock as any, {} as any);

      await expect(
        service.listMembers(organizationId, 'project-2', { userId: employeeId, permissions: employeePermissions, departmentId: null }),
      ).rejects.toThrow(NotFoundException);
      expect(memberFind).not.toHaveBeenCalled();
    });

    // 26/10/2026: ghi theo id ngoai pham vi xem -> 404 va KHONG ghi gi. Truoc day Manager phong khac tu
    // them minh lam thanh vien/lead cua du an minh khong thay duoc -> thay ngay du an + tai lieu du an.
    it('addMember()/update()/removeMember(): Manager ngoai pham vi -> NotFoundException, khong ghi thanh vien/lead', async () => {
      const projectRepoMock = {
        findOne: jest.fn().mockResolvedValue({ id: 'project-x', organizationId, leadUserId: null }),
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn(),
      };
      const assigneeRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])) };
      const memberRepo = { createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])), findOne: jest.fn() };
      const dimUserRepo = { find: jest.fn().mockResolvedValue([{ userId: 'dept-2-member' }]) };
      const transaction = jest.fn();
      const dataSourceMock = {
        getRepository: jest.fn().mockImplementation((entity) => (entity === DimUser ? dimUserRepo : memberRepo)),
        transaction,
      };
      const service = new ProjectsService(dataSourceMock as any, projectRepoMock as any, {} as any, assigneeRepoMock as any, {} as any);
      const caller = { userId: 'manager-2', permissions: managerPermissions, departmentId: 'dept-2' };

      await expect(service.addMember(organizationId, 'project-x', 'manager-2', 'manager-2', caller)).rejects.toThrow(NotFoundException);
      await expect(service.update(organizationId, 'project-x', { leadUserId: 'manager-2' } as any, 'manager-2', caller)).rejects.toThrow(NotFoundException);
      await expect(service.removeMember(organizationId, 'project-x', 'someone', 'manager-2', caller)).rejects.toThrow(NotFoundException);
      expect(memberRepo.findOne).not.toHaveBeenCalled();
      expect(projectRepoMock.save).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });

    it('update(): Org Admin (USER_MANAGE) khong bi gioi han pham vi - ghi binh thuong, khong truy van pham vi', async () => {
      const project = { id: 'project-x', organizationId, leadUserId: null, name: 'A' };
      const projectRepoMock = { findOne: jest.fn().mockResolvedValue(project), save: jest.fn().mockImplementation((p) => Promise.resolve(p)) };
      const service = new ProjectsService({} as any, projectRepoMock as any, {} as any, {} as any, {} as any);
      const caller = { userId: 'admin-1', permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.PROJECT_UPDATE], departmentId: null };

      await service.update(organizationId, 'project-x', { name: 'B' } as any, 'admin-1', caller);
      expect(projectRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'B' }));
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
      const memberRepoMock = { findOne: jest.fn().mockResolvedValue(undefined) };
      // 26/10/2026: them thanh vien gio chay trong transaction + ghi PROJECT_MEMBER_ADDED (Document
      // Service dung su kien nay de mo tai lieu du an cho thanh vien moi).
      const managerMock = {
        create: jest.fn().mockImplementation((_entity, data) => data),
        save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'member-1', ...data })),
      };
      const dataSourceMock = {
        getRepository: jest.fn().mockReturnValue(memberRepoMock),
        transaction: jest.fn((cb: any) => cb(managerMock)),
      };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        {} as any,
        {} as any,
        outboxServiceMock as any,
      );

      const result = await service.addMember(organizationId, projectId, actorId, userId);

      expect(result).toMatchObject({ projectId, userId, addedByUserId: actorId });
      expect(managerMock.save).toHaveBeenCalledTimes(1);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(managerMock, {
        eventType: EVENT_TYPES.PROJECT_MEMBER_ADDED,
        organizationId,
        producer: 'project-task-service',
        payload: { projectId, userId, actorId },
      });
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
      const memberRepoMock = { findOne: jest.fn().mockResolvedValue(existingMember) };
      // 26/10/2026: go thanh vien chay trong transaction + ghi PROJECT_MEMBER_REMOVED.
      const managerMock = { remove: jest.fn().mockResolvedValue(undefined) };
      const dataSourceMock = {
        getRepository: jest.fn().mockReturnValue(memberRepoMock),
        transaction: jest.fn((cb: any) => cb(managerMock)),
      };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new ProjectsService(
        dataSourceMock as any,
        projectRepoMock as any,
        {} as any,
        openTasksRepo(0) as any,
        outboxServiceMock as any,
      );

      await service.removeMember(organizationId, projectId, userId, actorId);

      expect(managerMock.remove).toHaveBeenCalledWith(existingMember);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({ eventType: EVENT_TYPES.PROJECT_MEMBER_REMOVED, payload: { projectId, userId, actorId } }),
      );
    });

    // 26/10/2026: thanh vien con Task chua xong trong du an -> 409, khong xoa, khong ghi outbox.
    it('removeMember: thanh vien con Task chua hoan thanh -> ConflictException PROJECT_MEMBER_HAS_OPEN_TASKS', async () => {
      const projectRepoMock = { findOne: jest.fn().mockResolvedValue({ id: projectId, organizationId, leadUserId: 'lead-1' }) };
      const memberRepoMock = { findOne: jest.fn().mockResolvedValue({ id: 'member-1', projectId, userId }) };
      const dataSourceMock = { getRepository: jest.fn().mockReturnValue(memberRepoMock), transaction: jest.fn() };
      const assigneeRepo = openTasksRepo(2);
      const service = new ProjectsService(dataSourceMock as any, projectRepoMock as any, {} as any, assigneeRepo as any, {} as any);

      await expect(service.removeMember(organizationId, projectId, userId, actorId)).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ errorCode: ERROR_CODES.PROJECT_MEMBER_HAS_OPEN_TASKS, errorParams: { count: 2 } }),
      });
      expect(assigneeRepo.qb.andWhere).toHaveBeenCalledWith('task.status != :done', { done: TaskStatus.DONE });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
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

      await expect(service.removeMember(organizationId, projectId, userId, actorId)).rejects.toThrow(
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
