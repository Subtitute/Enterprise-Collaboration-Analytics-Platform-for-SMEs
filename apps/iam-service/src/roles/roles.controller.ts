import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PaginationQueryDto, PERMISSIONS } from '@app/common-dto';
import { RolesService } from './roles.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
// 25/07/2026: pipe dung chung validate :id la UUID hop le truoc khi cham toi DB - xem chu thich
// chi tiet trong common/uuid-param.pipe.ts (loi MINOR, review 25/07/2026).
import { uuidParamPipe } from '../common/uuid-param.pipe';

/** Quan tri > Vai tro & Phan quyen - Wireframe.md muc 8. */
@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // 22/07/2026: map `Role.permissions` (quan he ManyToMany, tra ve Permission[] day du) sang
  // them field `permissionKeys: string[]` - Frontend (ma tran Vai tro & Phan quyen, Wireframe.md
  // muc 8) doc field nay de biet o nao da tick, doi xung voi body cua PATCH :id/permissions
  // ben duoi (cung nhan permissionKeys: string[]). Thieu field nay gay TypeError
  // "Cannot read properties of undefined (reading 'includes')" o frontend khi render ma tran.
  //
  // 22/07/2026: bo sung @RequirePermissions(ROLE_MANAGE) - truoc do endpoint nay khong co guard
  // nao, bat ky nhan vien da xac thuc (ke ca role Employee khong co quyen quan tri) deu goi duoc
  // va thay toan bo danh sach vai tro/quyen han cua ca to chuc, trai voi nguyen tac "moi endpoint,
  // ke ca GET, deu phai co permission guard" (Technical_Spec.md muc 6). Day la man hinh Quan tri >
  // Vai tro & Phan quyen (Wireframe.md muc 8), khong phai du lieu can thiet cho nhan vien thuong.
  @Get()
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  async findAll(@CurrentUser('organizationId') organizationId: string) {
    const roles = await this.rolesService.findAllForOrg(organizationId);
    return roles.map((role) => ({
      ...role,
      permissionKeys: role.permissions.map((p) => p.key),
    }));
  }

  // 22/07/2026: bo sung @RequirePermissions(ROLE_MANAGE) cung ly do nhu findAll() o tren - danh
  // sach Permission toan he thong chi phuc vu man hinh ma tran Vai tro & Phan quyen (quan tri),
  // truoc do bi bo ngo hoan toan (khong co guard).
  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Patch(':id/permissions')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  updatePermissions(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', uuidParamPipe()) roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    // 22/09/2026: can cho RolesService chan tu nang quyen + ghi audit log - xem chu thich chi tiet
    // tai RolesService.updateRolePermissions().
    @CurrentUser('userId') callerId: string,
    @CurrentUser('roles') callerRoleNames: string[],
  ) {
    return this.rolesService.updateRolePermissions(organizationId, roleId, dto.permissionKeys, callerId, callerRoleNames ?? []);
  }

  /** 22/09/2026: nhat ky thay doi quyen han (RBAC audit log, theo de xuat "log moi thay doi"). */
  @Get('audit-log')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  findPermissionChangeLog(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.rolesService.findPermissionChangeLog(organizationId, query);
  }
}
