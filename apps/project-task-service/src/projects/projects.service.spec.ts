import { BadRequestException } from '@nestjs/common';
import { EVENT_TYPES, ProjectStatus } from '@app/common-dto';
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

      const result = await service.findById(organizationId, projectId);

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

      const result = await service.findById(organizationId, projectId);

      expect(result).toMatchObject({ id: projectId, completionRate: 0, memberCount: 0 });
    });
  });
});
