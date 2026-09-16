import { SuperAdminBootstrapService } from './super-admin-bootstrap.service';

/**
 * 16/09/2026: unit test cho SuperAdminBootstrapService ("Super Admin", tinh nang moi) - mirror
 * pattern mock thu cong Repository/ConfigService da dung trong toan bo iam-service.
 */
describe('SuperAdminBootstrapService', () => {
  function createService(opts: {
    configValues?: Record<string, string | undefined>;
    existingUser?: unknown;
    existingOrg?: unknown;
  } = {}) {
    const userRepoMock = {
      findOne: jest.fn().mockResolvedValue('existingUser' in opts ? opts.existingUser : null),
      create: jest.fn((v: object) => v),
      save: jest.fn((v: object) => Promise.resolve({ id: 'super-admin-1', ...v })),
    };
    const organizationRepoMock = {
      findOne: jest.fn().mockResolvedValue('existingOrg' in opts ? opts.existingOrg : null),
      create: jest.fn((v: object) => v),
      save: jest.fn((v: object) => Promise.resolve({ id: 'platform-org-1', ...v })),
    };
    const configServiceMock = {
      get: jest.fn((key: string) => (opts.configValues ?? {})[key]),
    };

    const service = new SuperAdminBootstrapService(userRepoMock as any, organizationRepoMock as any, configServiceMock as any);
    return { service, userRepoMock, organizationRepoMock };
  }

  it('khong lam gi ca khi SUPER_ADMIN_EMAIL/PASSWORD chua duoc cau hinh (tinh nang tat)', async () => {
    const { service, userRepoMock, organizationRepoMock } = createService({ configValues: {} });

    await service.onModuleInit();

    expect(userRepoMock.findOne).not.toHaveBeenCalled();
    expect(organizationRepoMock.save).not.toHaveBeenCalled();
  });

  it('khong lam gi ca khi da co user dung email do (idempotent, khong ghi de tai khoan cu)', async () => {
    const { service, userRepoMock, organizationRepoMock } = createService({
      configValues: { 'superAdmin.email': 'super@ecap-platform.local', 'superAdmin.password': 'MatKhauMoi123!' },
      existingUser: { id: 'u1', email: 'super@ecap-platform.local' },
    });

    await service.onModuleInit();

    expect(userRepoMock.save).not.toHaveBeenCalled();
    expect(organizationRepoMock.save).not.toHaveBeenCalled();
  });

  it('tao moi to chuc he thong (isSystem=true) VA user Super Admin khi chua ton tai', async () => {
    const { service, userRepoMock, organizationRepoMock } = createService({
      configValues: {
        'superAdmin.email': 'Super@ECAP-Platform.local',
        'superAdmin.password': 'MatKhauMoi123!',
        'superAdmin.fullName': 'Super Admin',
      },
    });

    await service.onModuleInit();

    expect(organizationRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ isSystem: true }));
    expect(userRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'super@ecap-platform.local', // chuan hoa chu thuong, dong bo pattern login()/registerOrganization()
        isSuperAdmin: true,
        isActive: true,
        roles: [],
      }),
    );
  });

  it('tai su dung to chuc he thong DA CO (khong tao them 1 to chuc he thong thu 2)', async () => {
    const { service, userRepoMock, organizationRepoMock } = createService({
      configValues: { 'superAdmin.email': 'super@ecap-platform.local', 'superAdmin.password': 'MatKhauMoi123!' },
      existingOrg: { id: 'platform-org-1', name: 'Nen tang ECAP (Super Admin)', isSystem: true },
    });

    await service.onModuleInit();

    expect(organizationRepoMock.save).not.toHaveBeenCalled();
    expect(userRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'platform-org-1' }));
  });
});
