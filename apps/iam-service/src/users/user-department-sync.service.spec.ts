import { EVENT_TYPES } from '@app/common-dto';
import { UserDepartmentSyncService } from './user-department-sync.service';

/**
 * 28/07/2026: unit test moi cho UserDepartmentSyncService - buoc resync departmentId cua moi user
 * vao outbox MOI LAN iam-service khoi dong (xem chu thich chi tiet trong chinh
 * user-department-sync.service.ts ve ly do "phat lai toan bo moi lan khoi dong" la co chu dich).
 * Khong dung @nestjs/testing, khoi tao truc tiep service voi cac phu thuoc gia lap bang jest.fn(),
 * cung tinh than voi users.service.spec.ts trong cung thu muc.
 */
describe('UserDepartmentSyncService', () => {
  let qbMock: { select: jest.Mock; getMany: jest.Mock };
  let userRepo: { createQueryBuilder: jest.Mock };
  let outboxService: { record: jest.Mock };
  let managerMock: Record<string, never>;
  let dataSource: { transaction: jest.Mock };
  let service: UserDepartmentSyncService;

  beforeEach(() => {
    qbMock = { select: jest.fn().mockReturnThis(), getMany: jest.fn() };
    userRepo = { createQueryBuilder: jest.fn().mockReturnValue(qbMock) };
    outboxService = { record: jest.fn().mockResolvedValue(undefined) };
    managerMock = {};
    dataSource = {
      transaction: jest.fn(async (cb: (manager: typeof managerMock) => unknown) => cb(managerMock)),
    };

    service = new UserDepartmentSyncService(dataSource as any, userRepo as any, outboxService as any);
  });

  it('khong mo transaction va khong phat event nao neu he thong chua co user', async () => {
    qbMock.getMany.mockResolvedValue([]);

    await service.onApplicationBootstrap();

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(outboxService.record).not.toHaveBeenCalled();
  });

  it('truy van "lean" chi 3 cot id/organizationId/departmentId qua createQueryBuilder', async () => {
    qbMock.getMany.mockResolvedValue([]);

    await service.onApplicationBootstrap();

    expect(userRepo.createQueryBuilder).toHaveBeenCalledWith('u');
    expect(qbMock.select).toHaveBeenCalledWith(['u.id', 'u.organizationId', 'u.departmentId']);
  });

  it('phat 1 outbox event USER_DEPARTMENT_CHANGED cho MOI user, tren TAT CA to chuc, voi departmentId hien tai', async () => {
    qbMock.getMany.mockResolvedValue([
      { id: 'user-1', organizationId: 'org-1', departmentId: 'dept-1' },
      { id: 'user-2', organizationId: 'org-1', departmentId: null },
      { id: 'user-3', organizationId: 'org-2', departmentId: 'dept-9' },
    ]);

    await service.onApplicationBootstrap();

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(outboxService.record).toHaveBeenCalledTimes(3);
    expect(outboxService.record).toHaveBeenNthCalledWith(1, managerMock, {
      eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
      organizationId: 'org-1',
      producer: 'iam-service',
      payload: { userId: 'user-1', departmentId: 'dept-1' },
    });
    expect(outboxService.record).toHaveBeenNthCalledWith(2, managerMock, {
      eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
      organizationId: 'org-1',
      producer: 'iam-service',
      payload: { userId: 'user-2', departmentId: null },
    });
    expect(outboxService.record).toHaveBeenNthCalledWith(3, managerMock, {
      eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
      organizationId: 'org-2',
      producer: 'iam-service',
      payload: { userId: 'user-3', departmentId: 'dept-9' },
    });
  });
});
