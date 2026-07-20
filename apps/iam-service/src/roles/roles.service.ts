import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { DEFAULT_ROLE_PERMISSIONS, DefaultRoleName } from '@app/common-dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission) private readonly permissionRepo: Repository<Permission>,
  ) {}

  /** Seed 3 vai tro mac dinh (Org Admin/Manager/Employee) khi 1 to chuc dang ky moi. Dung trong transaction. */
  async seedDefaultRoles(
    manager: EntityManager,
    organizationId: string,
  ): Promise<Record<DefaultRoleName, Role>> {
    const allPermissions = await manager.find(Permission);
    const permissionByKey = new Map(allPermissions.map((p) => [p.key, p]));

    const result = {} as Record<DefaultRoleName, Role>;
    for (const roleName of Object.values(DefaultRoleName)) {
      const permissionKeys = DEFAULT_ROLE_PERMISSIONS[roleName];
      const permissions = permissionKeys
        .map((key) => permissionByKey.get(key))
        .filter((p): p is Permission => Boolean(p));
      const role = manager.create(Role, { organizationId, name: roleName, permissions });
      result[roleName] = await manager.save(role);
    }
    return result;
  }

  findAllForOrg(organizationId: string): Promise<Role[]> {
    return this.roleRepo.find({ where: { organizationId } });
  }

  findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({ order: { key: 'ASC' } });
  }

  async updateRolePermissions(
    organizationId: string,
    roleId: string,
    permissionKeys: string[],
  ): Promise<Role> {
    const role = await this.roleRepo.findOneOrFail({ where: { id: roleId, organizationId } });
    const permissions = await this.permissionRepo.find({ where: { key: In(permissionKeys) } });
    role.permissions = permissions;
    return this.roleRepo.save(role);
  }
}
