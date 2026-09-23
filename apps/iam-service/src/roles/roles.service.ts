import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { DEFAULT_ROLE_PERMISSIONS, DefaultRoleName, ERROR_CODES, PaginatedResponse, PaginationQueryDto, paginate } from '@app/common-dto';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermissionChangeLog } from '../entities/role-permission-change-log.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission) private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(RolePermissionChangeLog)
    private readonly changeLogRepo: Repository<RolePermissionChangeLog>,
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

  /**
   * 22/09/2026: `callerId`/`callerRoleNames` la nguoi dang goi PATCH nay - can cho ca 2 tinh nang
   * moi ben duoi (chan tu nang quyen + audit log), xem chu thich chi tiet tai tung buoc.
   */
  async updateRolePermissions(
    organizationId: string,
    roleId: string,
    permissionKeys: string[],
    callerId: string,
    callerRoleNames: string[],
  ): Promise<Role> {
    // 22/07/2026: findOneOrFail() nem TypeORM EntityNotFoundError (khong phai HttpException) khi
    // roleId sai/thuoc to chuc khac - AllExceptionsFilter (packages/common-guard, khong duoc sua o
    // day) khong biet map loi nay sang ma HTTP nao nen roi xuong 500 chung chung thay vi 404 dung
    // nghia (loi MINOR, review 22/07/2026). Doi sang findOne() + kiem tra null tuong tu cach
    // DepartmentsService/UsersService trong cung service nay xu ly "khong tim thay".
    const role = await this.roleRepo.findOne({ where: { id: roleId, organizationId } });
    if (!role) throw new NotFoundException({ message: 'Khong tim thay vai tro', errorCode: ERROR_CODES.ROLE_NOT_FOUND });

    // 22/09/2026: chan tu nang quyen - nguoi goi khong duoc sua tap quyen cua CHINH vai tro ho dang
    // giu (vd 1 Org Admin tu bo quyen ROLE_MANAGE khoi vai tro Org Admin se tu khoa minh khoi khu
    // vuc Quan tri vinh vien; ve nguyen tac, cung khong ai duoc tu cap them quyen cho chinh minh).
    // So sanh theo TEN vai tro (khong phai id) vi AuthContext/JWT (xem AuthService.login()) chi
    // mang ten vai tro, khong mang id - an toan vi to chuc nay khong the tao vai tro tuy y (chi co
    // dung 3 vai tro mac dinh duoc seed luc dang ky, xem RolesController: khong co endpoint tao vai
    // tro moi), nen ten vai tro la dinh danh on dinh trong pham vi 1 to chuc.
    if (callerRoleNames.includes(role.name)) {
      throw new ForbiddenException({
        message: 'Khong the tu thay doi quyen han cua chinh vai tro ban dang giu - hay nho 1 quan tri vien khac thuc hien',
        errorCode: ERROR_CODES.FORBIDDEN_SELF_ROLE_PERMISSION_CHANGE,
      });
    }

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

    // 22/09/2026: log moi lan thay doi (audit) - CHI ghi khi tap quyen THUC SU doi (so sanh tap
    // key cu/moi, khong phu thuoc thu tu phan tu) de tranh log rac khi client PATCH lai dung tap
    // quyen hien tai (khong doi gi ca). Ghi trong CUNG transaction voi viec luu Role de dam bao
    // tinh nhat quan (khong bao gio co truong hop doi quyen thanh cong nhung thieu dong log, hoac
    // nguoc lai).
    const previousKeys = role.permissions.map((p) => p.key).sort();
    const newKeys = permissions.map((p) => p.key).sort();
    const hasChanged = previousKeys.length !== newKeys.length || previousKeys.some((k, i) => k !== newKeys[i]);

    role.permissions = permissions;

    return this.dataSource.transaction(async (manager) => {
      const updated = await manager.save(role);

      if (hasChanged) {
        await manager.save(
          manager.create(RolePermissionChangeLog, {
            organizationId,
            roleId: role.id,
            roleName: role.name,
            actorId: callerId,
            previousPermissionKeys: previousKeys,
            newPermissionKeys: newKeys,
          }),
        );
      }

      return updated;
    });
  }

  /** Nhat ky thay doi quyen han (RBAC audit log) - Quan tri > Vai tro & Phan quyen, PERMISSIONS.ROLE_MANAGE. */
  async findPermissionChangeLog(
    organizationId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<RolePermissionChangeLog>> {
    const [data, total] = await this.changeLogRepo.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }
}
