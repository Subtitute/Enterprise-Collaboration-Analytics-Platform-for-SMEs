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
  let qbMock: { leftJoin: jest.Mock; select: jest.Mock; getMany: jest.Mock };
  let userRepo: { createQueryBuilder: jest.Mock };
  let outboxService: { record: jest.Mock };
  let managerMock: Record<string, never>;
  let dataSource: { transaction: jest.Mock; query: jest.Mock };
  let service: UserDepartmentSyncService;

  beforeEach(() => {
    qbMock = { leftJoin: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), getMany: jest.fn() };
    userRepo = { createQueryBuilder: jest.fn().mockReturnValue(qbMock) };
    outboxService = { record: jest.fn().mockResolvedValue(undefined) };
    managerMock = {};
    dataSource = {
      transaction: jest.fn(async (cb: (manager: typeof managerMock) => unknown) => cb(managerMock)),
      query: jest.fn().mockResolvedValue([]),
    };

    service = new UserDepartmentSyncService(dataSource as any, userRepo as any, outboxService as any);
  });

  it('khong mo transaction va khong phat event nao neu he thong chua co user', async () => {
    qbMock.getMany.mockResolvedValue([]);

    await service.onApplicationBootstrap();

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(outboxService.record).not.toHaveBeenCalled();
  });

  // 26/10/2026: them ten vai tro (resync muc vai tro cho ml-service, Technical_Spec.md muc 27.4).
  it('truy van "lean" chi id/organizationId/departmentId + ten vai tro qua createQueryBuilder', async () => {
    qbMock.getMany.mockResolvedValue([]);

    await service.onApplicationBootstrap();

    expect(userRepo.createQueryBuilder).toHaveBeenCalledWith('u');
    expect(qbMock.leftJoin).toHaveBeenCalledWith('u.roles', 'r');
    expect(qbMock.select).toHaveBeenCalledWith(['u.id', 'u.organizationId', 'u.departmentId', 'u.isActive', 'r.id', 'r.name']);
  });

  it('phat 1 outbox event USER_DEPARTMENT_CHANGED cho MOI user, tren TAT CA to chuc, voi departmentId hien tai', async () => {
    qbMock.getMany.mockResolvedValue([
      { id: 'user-1', organizationId: 'org-1', departmentId: 'dept-1' },
      { id: 'user-2', organizationId: 'org-1', departmentId: null },
      { id: 'user-3', organizationId: 'org-2', departmentId: 'dept-9', isActive: false, roles: [{ id: 'r', name: 'Manager' }] },
    ]);

    await service.onApplicationBootstrap();

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    // 26/10/2026: moi user 2 event - department_changed roi roles_changed (khong co vai tro -> EMPLOYEE).
    expect(outboxService.record).toHaveBeenCalledTimes(6);
    expect(outboxService.record).toHaveBeenNthCalledWith(2, managerMock, {
      eventType: EVENT_TYPES.USER_ROLES_CHANGED,
      organizationId: 'org-1',
      producer: 'iam-service',
      payload: { userId: 'user-1', roleLevel: 'EMPLOYEE', actorId: null, isActive: true },
    });
    expect(outboxService.record).toHaveBeenNthCalledWith(1, managerMock, {
      eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
      organizationId: 'org-1',
      producer: 'iam-service',
      // 23/09/2026: actorId: null - day la buoc TU DONG resync luc khoi dong, khong phai do 1
      // nguoi vua thao tac (xem chu thich UserDepartmentChangedPayload.actorId, common-dto).
      payload: { userId: 'user-1', departmentId: 'dept-1', actorId: null },
    });
    expect(outboxService.record).toHaveBeenNthCalledWith(3, managerMock, {
      eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
      organizationId: 'org-1',
      producer: 'iam-service',
      payload: { userId: 'user-2', departmentId: null, actorId: null },
    });
    expect(outboxService.record).toHaveBeenNthCalledWith(5, managerMock, {
      eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
      organizationId: 'org-2',
      producer: 'iam-service',
      payload: { userId: 'user-3', departmentId: 'dept-9', actorId: null },
    });
    expect(outboxService.record).toHaveBeenNthCalledWith(6, managerMock, {
      eventType: EVENT_TYPES.USER_ROLES_CHANGED,
      organizationId: 'org-2',
      producer: 'iam-service',
      payload: { userId: 'user-3', roleLevel: 'MANAGER', actorId: null, isActive: false },
    });
  });

  // 26/10/2026: user dang hoat dong nhung 0 vai tro -> gan Employee cua to chuc (idempotent, chay truoc resync).
  it('backfill vai tro Employee mac dinh truoc khi resync, loi SQL khong lam hong buoc khoi dong', async () => {
    qbMock.getMany.mockResolvedValue([]);
    dataSource.query.mockResolvedValueOnce([{ user_id: 'u-1' }, { user_id: 'u-2' }]);
    await service.onApplicationBootstrap();
    const [sqlText, params] = dataSource.query.mock.calls[0];
    expect(sqlText).toContain('INSERT INTO user_roles');
    expect(sqlText).toContain('NOT EXISTS');
    expect(sqlText).toContain('u.is_active = true');
    expect(params).toEqual(['Employee']);

    dataSource.query.mockRejectedValueOnce(new Error('db down'));
    await expect(service.backfillDefaultRoles()).resolves.toBe(0);
  });
});
