import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';

/**
 * 25/07/2026: unit test moi cho RolesService.updateRolePermissions() - truoc day KHONG ton tai
 * bat ky test nao cho service nay (no debt tu vong review truoc, xem bao cao cuoi cung). Bao ve 2
 * nhanh quan trong:
 *   1) NotFoundException khi roleId sai/thuoc to chuc khac (Fix MINOR, review 22/07/2026 - doi tu
 *      findOneOrFail() sang findOne() + kiem tra null).
 *   2) BadRequestException moi khi 1+ permissionKeys khong resolve duoc thanh Permission nao trong
 *      DB, thay vi am tham bo qua nhu truoc (Fix MINOR, review 25/07/2026).
 */
describe('RolesService.updateRolePermissions()', () => {
  const ORG_ID = 'org-1';
  const ROLE_ID = 'role-1';

  let roleRepo: { findOne: jest.Mock; save: jest.Mock };
  let permissionRepo: { find: jest.Mock };
  let service: RolesService;

  beforeEach(() => {
    roleRepo = { findOne: jest.fn(), save: jest.fn() };
    permissionRepo = { find: jest.fn() };
    service = new RolesService(roleRepo as any, permissionRepo as any);
  });

  it('tu choi (404) khi role khong ton tai hoac thuoc to chuc khac', async () => {
    roleRepo.findOne.mockResolvedValue(null);

    await expect(
      service.updateRolePermissions(ORG_ID, ROLE_ID, ['user:invite']),
    ).rejects.toThrow(NotFoundException);
    expect(permissionRepo.find).not.toHaveBeenCalled();
    expect(roleRepo.save).not.toHaveBeenCalled();
  });

  it('tu choi (400) va neu ro key khong hop le khi 1 permissionKey khong resolve duoc trong DB', async () => {
    roleRepo.findOne.mockResolvedValue({ id: ROLE_ID, organizationId: ORG_ID, permissions: [] });
    // Client gui 2 key, nhung DB chi tra ve 1 permission ton tai thuc su - key con lai sai chinh
    // ta/da bi xoa.
    permissionRepo.find.mockResolvedValue([{ id: 'p1', key: 'user:invite' }]);

    await expect(
      service.updateRolePermissions(ORG_ID, ROLE_ID, ['user:invite', 'user:khong-ton-tai']),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.updateRolePermissions(ORG_ID, ROLE_ID, ['user:invite', 'user:khong-ton-tai']),
    ).rejects.toThrow(/user:khong-ton-tai/);
    expect(roleRepo.save).not.toHaveBeenCalled();
  });

  it('KHONG bao loi gia khi client gui trung 1 permissionKey hop le nhieu lan (chi du thua, khong sai)', async () => {
    const role = { id: ROLE_ID, organizationId: ORG_ID, permissions: [] };
    roleRepo.findOne.mockResolvedValue(role);
    permissionRepo.find.mockResolvedValue([{ id: 'p1', key: 'user:invite' }]);
    roleRepo.save.mockImplementation(async (r: any) => r);

    const result = await service.updateRolePermissions(ORG_ID, ROLE_ID, [
      'user:invite',
      'user:invite',
    ]);

    expect(result.permissions).toEqual([{ id: 'p1', key: 'user:invite' }]);
  });

  it('cap nhat thanh cong khi moi permissionKeys deu resolve duoc', async () => {
    const role = { id: ROLE_ID, organizationId: ORG_ID, permissions: [] };
    roleRepo.findOne.mockResolvedValue(role);
    const resolvedPermissions = [
      { id: 'p1', key: 'user:invite' },
      { id: 'p2', key: 'user:manage' },
    ];
    permissionRepo.find.mockResolvedValue(resolvedPermissions);
    roleRepo.save.mockImplementation(async (r: any) => r);

    const result = await service.updateRolePermissions(ORG_ID, ROLE_ID, [
      'user:invite',
      'user:manage',
    ]);

    expect(result.permissions).toEqual(resolvedPermissions);
    expect(roleRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: resolvedPermissions }),
    );
  });
});
