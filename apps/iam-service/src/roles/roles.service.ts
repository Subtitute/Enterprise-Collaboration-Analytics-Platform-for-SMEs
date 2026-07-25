import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    // 22/07/2026: findOneOrFail() nem TypeORM EntityNotFoundError (khong phai HttpException) khi
    // roleId sai/thuoc to chuc khac - AllExceptionsFilter (packages/common-guard, khong duoc sua o
    // day) khong biet map loi nay sang ma HTTP nao nen roi xuong 500 chung chung thay vi 404 dung
    // nghia (loi MINOR, review 22/07/2026). Doi sang findOne() + kiem tra null tuong tu cach
    // DepartmentsService/UsersService trong cung service nay xu ly "khong tim thay".
    const role = await this.roleRepo.findOne({ where: { id: roleId, organizationId } });
    if (!role) throw new NotFoundException('Khong tim thay vai tro');
    const permissions = await this.permissionRepo.find({ where: { key: In(permissionKeys) } });

    // 25/07/2026: MINOR (review 25/07/2026) - truoc day permissionKeys khong resolve duoc thanh
    // Permission nao (vd client go sai chinh ta 1 key, hoac gui 1 key da bi xoa/doi ten) bi AM
    // THAM bo qua: `permissions` chi chua nhung key resolve THANH CONG, con lai "bien mat" khong 1
    // loi bao nao - client tuong da luu dung permissionKeys gui len nhung thuc te vai tro bi luu
    // THIEU quyen so voi y dinh (vd tick 5 quyen, chi 4 quyen ton tai thuc su duoc luu, quyen thu
    // 5 bi ngam roi mat ma khong ai biet). So sanh voi SO LUONG KEY DUY NHAT trong request (khong
    // phai do dai mang tho) de tranh bao loi gia khi client gui trung 1 key nhieu lan (khong sai,
    // chi du thua) - neu co khac biet thuc su thi liet ke chinh xac (nhung) key khong hop le trong
    // thong bao loi 400 de client/nguoi dung sua ngay, thay vi "thanh cong" sai lech am tham.
    const uniqueRequestedKeys = new Set(permissionKeys);
    if (permissions.length !== uniqueRequestedKeys.size) {
      const resolvedKeys = new Set(permissions.map((p) => p.key));
      const invalidKeys = [...uniqueRequestedKeys].filter((key) => !resolvedKeys.has(key));
      throw new BadRequestException(`Permission key khong hop le: ${invalidKeys.join(', ')}`);
    }

    role.permissions = permissions;
    return this.roleRepo.save(role);
  }
}
