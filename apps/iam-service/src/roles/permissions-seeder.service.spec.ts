// 24/10/2026: test moi cho PermissionsSeederService - ngoai viec seed permission toan cuc, luc khoi
// dong phai bo sung permission con thieu cho vai tro Org Admin cua MOI to chuc da ton tai (to chuc
// dang ky truoc khi permission moi ra doi), chi them phan thieu va khong dung toi Manager/Employee.
import { PermissionsSeederService } from './permissions-seeder.service';
import { PERMISSIONS } from '@app/common-dto';

describe('PermissionsSeederService', () => {
  const allKeys = Object.values(PERMISSIONS);
  const allPermissions = allKeys.map((key, i) => ({ id: `p${i}`, key }));

  function build(roles: Array<{ id: string; name: string; permissions: Array<{ id: string }> }>) {
    const add = jest.fn().mockResolvedValue(undefined);
    const of = jest.fn().mockReturnValue({ add });
    const relation = jest.fn().mockReturnValue({ of });
    const permissionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'x' }), // moi permission da ton tai
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn().mockResolvedValue(allPermissions),
    };
    const roleRepo = {
      find: jest.fn().mockResolvedValue(roles),
      createQueryBuilder: jest.fn().mockReturnValue({ relation }),
    };
    const service = new PermissionsSeederService(permissionRepo as never, roleRepo as never);
    return { service, roleRepo, of, add };
  }

  it('chi tim vai tro ten "Org Admin" va them DUNG cac permission con thieu', async () => {
    const { service, roleRepo, of, add } = build([
      { id: 'old-org-admin', name: 'Org Admin', permissions: allPermissions.slice(0, allPermissions.length - 2) },
    ]);
    await service.onApplicationBootstrap();
    expect(roleRepo.find).toHaveBeenCalledWith({ where: { name: 'Org Admin' } });
    expect(of).toHaveBeenCalledWith('old-org-admin');
    expect(add).toHaveBeenCalledWith(allPermissions.slice(-2).map((p) => p.id));
  });

  it('khong ghi gi khi Org Admin da du quyen (idempotent)', async () => {
    const { service, add } = build([{ id: 'full', name: 'Org Admin', permissions: allPermissions }]);
    await service.onApplicationBootstrap();
    expect(add).not.toHaveBeenCalled();
  });
});
