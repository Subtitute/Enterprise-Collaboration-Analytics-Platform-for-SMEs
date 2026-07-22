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
});
