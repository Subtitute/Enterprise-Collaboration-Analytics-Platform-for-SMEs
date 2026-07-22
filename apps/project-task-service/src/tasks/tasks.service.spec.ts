import { BadRequestException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { TaskStatus } from '@app/common-dto';
import { TasksService } from './tasks.service';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

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

      const result = await service.findAll(organizationId, { page: 1, limit: 20 } as any);

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

      const result = await service.findAll(organizationId, { page: 1, limit: 20 } as any);

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

      const result = await service.findById(organizationId, taskId);

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
  });
});
