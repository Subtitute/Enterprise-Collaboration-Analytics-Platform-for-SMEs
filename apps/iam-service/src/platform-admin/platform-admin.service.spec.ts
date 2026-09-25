import { NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '@app/common-dto';
import { PlatformAdminService } from './platform-admin.service';

/**
 * 16/09/2026: unit test cho PlatformAdminService ("Super Admin", tinh nang moi) - mirror pattern
 * mock thu cong Repository/RedisService/ConfigService da dung trong leave-requests.service.spec.ts/
 * calendar-events.service.spec.ts (khong boot NestJS module hay DB that).
 */
describe('PlatformAdminService', () => {
  const orgId = 'org-1';

  function existingOrg(overrides: Record<string, unknown> = {}) {
    return {
      id: orgId,
      name: 'Cong ty ABC',
      taxCode: '0101234567',
      isActive: true,
      isSystem: false,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      ...overrides,
    };
  }

  function createService(opts: {
    organizationRepoMock?: Partial<Record<string, jest.Mock>>;
    userRepoMock?: Partial<Record<string, jest.Mock>>;
    redisServiceMock?: Partial<Record<string, jest.Mock>>;
    rolesServiceMock?: Partial<Record<string, jest.Mock>>;
    configValues?: Record<string, string>;
  } = {}) {
    const organizationRepoMock = {
      findAndCount: jest.fn().mockResolvedValue([[existingOrg()], 1]),
      findOne: jest.fn().mockResolvedValue(existingOrg()),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      count: jest.fn().mockResolvedValue(0),
      ...opts.organizationRepoMock,
    };
    const userRepoMock = {
      count: jest.fn().mockResolvedValue(3),
      find: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]),
      ...opts.userRepoMock,
    };
    const redisServiceMock = {
      blacklistUser: jest.fn().mockResolvedValue(undefined),
      ...opts.redisServiceMock,
    };
    const configServiceMock = {
      get: jest.fn((key: string) => (opts.configValues ?? {})[key] ?? '15m'),
    };
    // 25/09/2026: mock cho RolesService (tinh nang moi - Super Admin sua quyen han 1 vai tro trong
    // 1 to chuc bat ky, xem PlatformAdminService.updateOrgRolePermissions()).
    const rolesServiceMock = {
      updateRolePermissions: jest.fn().mockResolvedValue({ id: 'role-1', name: 'Org Admin', permissions: [] }),
      ...opts.rolesServiceMock,
    };

    const service = new PlatformAdminService(
      organizationRepoMock as any,
      userRepoMock as any,
      redisServiceMock as any,
      configServiceMock as any,
      rolesServiceMock as any,
    );
    return { service, organizationRepoMock, userRepoMock, redisServiceMock, rolesServiceMock };
  }

  describe('listOrganizations', () => {
    it('chi liet ke to chuc isSystem=false, kem userCount tung to chuc', async () => {
      const { service, organizationRepoMock, userRepoMock } = createService();

      const result = await service.listOrganizations({ page: 1, limit: 20 });

      expect(organizationRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isSystem: false } }),
      );
      expect(userRepoMock.count).toHaveBeenCalledWith({ where: { organizationId: orgId } });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].userCount).toBe(3);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getOrganization', () => {
    it('tra ve dung thong tin khi to chuc ton tai va khong phai to chuc he thong', async () => {
      const { service } = createService();
      const result = await service.getOrganization(orgId);
      expect(result.id).toBe(orgId);
      expect(result.userCount).toBe(3);
    });

    it('nem NotFoundException/ORGANIZATION_NOT_FOUND khi khong tim thay', async () => {
      const { service } = createService({
        organizationRepoMock: { findOne: jest.fn().mockResolvedValue(null) },
      });

      let caught: NotFoundException | undefined;
      try {
        await service.getOrganization('khong-ton-tai');
      } catch (err) {
        caught = err as NotFoundException;
      }
      expect(caught).toBeInstanceOf(NotFoundException);
      expect((caught?.getResponse() as { errorCode: string }).errorCode).toBe(ERROR_CODES.ORGANIZATION_NOT_FOUND);
    });

    // 16/09/2026: to chuc he thong (an cu Super Admin) BI LOC khoi findOne() qua dieu kien
    // isSystem: false trong cau where - dam bao Super Admin khong tu quan ly/khoa nham chinh to
    // chuc cua minh qua API nay (xem chu thich Organization.isSystem).
    it('coi to chuc he thong (isSystem=true) la "khong tim thay" - khong the quan ly qua API nay', async () => {
      const { service, organizationRepoMock } = createService({
        organizationRepoMock: { findOne: jest.fn().mockResolvedValue(null) },
      });

      await expect(service.getOrganization('platform-org-id')).rejects.toThrow(NotFoundException);
      expect(organizationRepoMock.findOne).toHaveBeenCalledWith({
        where: { id: 'platform-org-id', isSystem: false },
      });
    });
  });

  describe('setOrganizationActive', () => {
    it('khoa to chuc (isActive=false): luu DB VA blacklist Redis cho MOI user thuoc to chuc', async () => {
      const { service, organizationRepoMock, userRepoMock, redisServiceMock } = createService();

      const result = await service.setOrganizationActive(orgId, false);

      expect(organizationRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
      expect(userRepoMock.find).toHaveBeenCalledWith({ where: { organizationId: orgId }, select: ['id'] });
      expect(redisServiceMock.blacklistUser).toHaveBeenCalledTimes(2);
      expect(redisServiceMock.blacklistUser).toHaveBeenCalledWith('u1', expect.any(Number));
      expect(redisServiceMock.blacklistUser).toHaveBeenCalledWith('u2', expect.any(Number));
      expect(result.isActive).toBe(false);
    });

    it('mo khoa to chuc (isActive=true): luu DB, KHONG goi Redis blacklist', async () => {
      const { service, organizationRepoMock, redisServiceMock } = createService();

      const result = await service.setOrganizationActive(orgId, true);

      expect(organizationRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
      expect(redisServiceMock.blacklistUser).not.toHaveBeenCalled();
      expect(result.isActive).toBe(true);
    });

    it('Redis blacklist that bai: khong nem loi (fail-open), to chuc van da bi khoa trong DB', async () => {
      const { service, organizationRepoMock } = createService({
        userRepoMock: { find: jest.fn().mockResolvedValue([{ id: 'u1' }]) },
        redisServiceMock: { blacklistUser: jest.fn().mockRejectedValue(new Error('Redis down')) },
      });

      const result = await service.setOrganizationActive(orgId, false);
      expect(result.isActive).toBe(false);
      expect(organizationRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });
  });

  describe('updateOrgRolePermissions', () => {
    it('goi lai RolesService.updateRolePermissions voi callerRoleNames=[] (Super Admin khong giu vai tro nao trong to chuc)', async () => {
      const { service, rolesServiceMock } = createService();

      await service.updateOrgRolePermissions(orgId, 'role-1', ['ml:view'], 'super-admin-id');

      expect(rolesServiceMock.updateRolePermissions).toHaveBeenCalledWith(orgId, 'role-1', ['ml:view'], 'super-admin-id', []);
    });

    it('nem NotFoundException/ORGANIZATION_NOT_FOUND khi to chuc khong ton tai, KHONG goi RolesService', async () => {
      const { service, rolesServiceMock } = createService({
        organizationRepoMock: { findOne: jest.fn().mockResolvedValue(null) },
      });

      await expect(service.updateOrgRolePermissions('khong-ton-tai', 'role-1', ['ml:view'], 'super-admin-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(rolesServiceMock.updateRolePermissions).not.toHaveBeenCalled();
    });
  });

  describe('getPlatformStats', () => {
    it('tinh dung 3 chi so, khong tinh Super Admin vao totalUsers', async () => {
      const { service, organizationRepoMock, userRepoMock } = createService({
        organizationRepoMock: {
          count: jest
            .fn()
            .mockResolvedValueOnce(5) // totalOrganizations
            .mockResolvedValueOnce(4), // activeOrganizations
        },
        userRepoMock: { count: jest.fn().mockResolvedValue(42) },
      });

      const result = await service.getPlatformStats();

      expect(organizationRepoMock.count).toHaveBeenNthCalledWith(1, { where: { isSystem: false } });
      expect(organizationRepoMock.count).toHaveBeenNthCalledWith(2, { where: { isSystem: false, isActive: true } });
      expect(userRepoMock.count).toHaveBeenCalledWith({ where: { isSuperAdmin: false } });
      expect(result).toEqual({ totalOrganizations: 5, activeOrganizations: 4, totalUsers: 42 });
    });
  });
});
