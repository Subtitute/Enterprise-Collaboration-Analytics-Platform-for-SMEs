import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '@app/common-dto';
import { RolesService } from './roles.service';

/**
 * 25/07/2026: unit test moi cho RolesService.updateRolePermissions() - truoc day KHONG ton tai
 * bat ky test nao cho service nay (no debt tu vong review truoc, xem bao cao cuoi cung). Bao ve 2
 * nhanh quan trong:
 *   1) NotFoundException khi roleId sai/thuoc to chuc khac (Fix MINOR, review 22/07/2026 - doi tu
 *      findOneOrFail() sang findOne() + kiem tra null).
 *   2) BadRequestException moi khi 1+ permissionKeys khong resolve duoc thanh Permission nao trong
 *      DB, thay vi am tham bo qua nhu truoc (Fix MINOR, review 25/07/2026).
 *
 * 22/09/2026: bo sung 2 tinh nang moi (RBAC audit, theo de xuat cua Tien) - chan tu nang quyen +
 * ghi audit log. Constructor gio can them dataSourceMock/changeLogRepoMock (mirror pattern
 * leave-requests.service.spec.ts: transaction chi goi lai callback voi managerMock).
 */
describe('RolesService.updateRolePermissions()', () => {
  const ORG_ID = 'org-1';
  const ROLE_ID = 'role-1';
  const CALLER_ID = 'caller-1';

  let roleRepo: { findOne: jest.Mock; save: jest.Mock };
  let permissionRepo: { find: jest.Mock };
  let changeLogRepo: { findAndCount: jest.Mock };
  let managerMock: { save: jest.Mock; create: jest.Mock };
  let dataSourceMock: { transaction: jest.Mock };
  let service: RolesService;

  beforeEach(() => {
    roleRepo = { findOne: jest.fn(), save: jest.fn() };
    permissionRepo = { find: jest.fn() };
    changeLogRepo = { findAndCount: jest.fn() };
    managerMock = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      create: jest.fn().mockImplementation((_entityClass: unknown, data: unknown) => data),
    };
    dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
    service = new RolesService(dataSourceMock as any, roleRepo as any, permissionRepo as any, changeLogRepo as any);
  });

  /** Nguoi goi khong giu vai tro dang duoc sua (mac dinh cho da so test - cac role fixture ben duoi
   *  deu ten 'Manager', chi rieng test tu nang quyen dung 'Org Admin'; chi test rieng cho nhanh
   *  chan tu nang quyen la Org Admin sua Org Admin). */
  const OTHER_CALLER_ROLES = ['Org Admin'];

  it('tu choi (404) khi role khong ton tai hoac thuoc to chuc khac', async () => {
    roleRepo.findOne.mockResolvedValue(null);

    await expect(
      service.updateRolePermissions(ORG_ID, ROLE_ID, ['user:invite'], CALLER_ID, OTHER_CALLER_ROLES),
    ).rejects.toThrow(NotFoundException);
    expect(permissionRepo.find).not.toHaveBeenCalled();
    expect(dataSourceMock.transaction).not.toHaveBeenCalled();
  });

  it('tu choi (403) khi nguoi goi tu sua quyen cua CHINH vai tro ho dang giu (chan tu nang quyen)', async () => {
    roleRepo.findOne.mockResolvedValue({ id: ROLE_ID, organizationId: ORG_ID, name: 'Org Admin', permissions: [] });

    await expect(
      service.updateRolePermissions(ORG_ID, ROLE_ID, ['user:invite'], CALLER_ID, ['Org Admin']),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: ERROR_CODES.FORBIDDEN_SELF_ROLE_PERMISSION_CHANGE }),
    });
    await expect(
      service.updateRolePermissions(ORG_ID, ROLE_ID, ['user:invite'], CALLER_ID, ['Org Admin']),
    ).rejects.toThrow(ForbiddenException);
    expect(permissionRepo.find).not.toHaveBeenCalled();
    expect(dataSourceMock.transaction).not.toHaveBeenCalled();
  });

  it('cho phep sua quyen cua 1 vai tro KHAC vai tro nguoi goi dang giu', async () => {
    const role = { id: ROLE_ID, organizationId: ORG_ID, name: 'Manager', permissions: [] };
    roleRepo.findOne.mockResolvedValue(role);
    permissionRepo.find.mockResolvedValue([{ id: 'p1', key: 'user:invite' }]);

    const result = await service.updateRolePermissions(
      ORG_ID,
      ROLE_ID,
      ['user:invite'],
      CALLER_ID,
      ['Org Admin'], // nguoi goi la Org Admin, sua vai tro Manager - khac nhau, duoc phep.
    );

    expect(result.permissions).toEqual([{ id: 'p1', key: 'user:invite' }]);
  });

  it('tu choi (400) va neu ro key khong hop le khi 1 permissionKey khong resolve duoc trong DB', async () => {
    roleRepo.findOne.mockResolvedValue({ id: ROLE_ID, organizationId: ORG_ID, name: 'Manager', permissions: [] });
    // Client gui 2 key, nhung DB chi tra ve 1 permission ton tai thuc su - key con lai sai chinh
    // ta/da bi xoa.
    permissionRepo.find.mockResolvedValue([{ id: 'p1', key: 'user:invite' }]);

    await expect(
      service.updateRolePermissions(ORG_ID, ROLE_ID, ['user:invite', 'user:khong-ton-tai'], CALLER_ID, OTHER_CALLER_ROLES),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.updateRolePermissions(ORG_ID, ROLE_ID, ['user:invite', 'user:khong-ton-tai'], CALLER_ID, OTHER_CALLER_ROLES),
    ).rejects.toThrow(/user:khong-ton-tai/);
    expect(dataSourceMock.transaction).not.toHaveBeenCalled();
  });

  it('KHONG bao loi gia khi client gui trung 1 permissionKey hop le nhieu lan (chi du thua, khong sai)', async () => {
    const role = { id: ROLE_ID, organizationId: ORG_ID, name: 'Manager', permissions: [] };
    roleRepo.findOne.mockResolvedValue(role);
    permissionRepo.find.mockResolvedValue([{ id: 'p1', key: 'user:invite' }]);

    const result = await service.updateRolePermissions(
      ORG_ID,
      ROLE_ID,
      ['user:invite', 'user:invite'],
      CALLER_ID,
      OTHER_CALLER_ROLES,
    );

    expect(result.permissions).toEqual([{ id: 'p1', key: 'user:invite' }]);
  });

  it('cap nhat thanh cong khi moi permissionKeys deu resolve duoc, ghi 1 dong audit log trong CUNG transaction', async () => {
    const role = { id: ROLE_ID, organizationId: ORG_ID, name: 'Manager', permissions: [] };
    roleRepo.findOne.mockResolvedValue(role);
    const resolvedPermissions = [
      { id: 'p1', key: 'user:invite' },
      { id: 'p2', key: 'user:manage' },
    ];
    permissionRepo.find.mockResolvedValue(resolvedPermissions);

    const result = await service.updateRolePermissions(
      ORG_ID,
      ROLE_ID,
      ['user:invite', 'user:manage'],
      CALLER_ID,
      OTHER_CALLER_ROLES,
    );

    expect(result.permissions).toEqual(resolvedPermissions);
    expect(managerMock.save).toHaveBeenCalledWith(expect.objectContaining({ permissions: resolvedPermissions }));
    expect(managerMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        roleId: ROLE_ID,
        roleName: 'Manager',
        actorId: CALLER_ID,
        previousPermissionKeys: [],
        newPermissionKeys: ['user:invite', 'user:manage'],
      }),
    );
  });

  it('KHONG ghi audit log neu tap quyen moi giong het tap quyen cu (PATCH lai dung hien trang, khong doi gi)', async () => {
    const role = {
      id: ROLE_ID,
      organizationId: ORG_ID,
      name: 'Manager',
      permissions: [{ id: 'p1', key: 'user:invite' }],
    };
    roleRepo.findOne.mockResolvedValue(role);
    permissionRepo.find.mockResolvedValue([{ id: 'p1', key: 'user:invite' }]);

    await service.updateRolePermissions(ORG_ID, ROLE_ID, ['user:invite'], CALLER_ID, OTHER_CALLER_ROLES);

    // Chi 1 lan save (Role) - khong co lan save nao cho RolePermissionChangeLog.
    expect(managerMock.save).toHaveBeenCalledTimes(1);
  });
});
