import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequireSuperAdmin } from '@app/common-guard';
import { PaginationQueryDto } from '@app/common-dto';
import { PlatformAdminService } from './platform-admin.service';
import { uuidParamPipe } from '../common/uuid-param.pipe';
import { UpdateRolePermissionsDto } from '../roles/dto/update-role-permissions.dto';

/**
 * 16/09/2026: "Super Admin" (tinh nang moi) - quan ly to chuc (tenant) o cap nen tang. Ca 5
 * route deu gate bang @RequireSuperAdmin() (SuperAdminGuard, @app/common-guard) - KHONG dung
 * @RequirePermissions() vi Super Admin khong tham gia ma tran RBAC theo to chuc.
 */
@ApiTags('Platform Admin')
@ApiBearerAuth()
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('organizations')
  @RequireSuperAdmin()
  listOrganizations(@Query() query: PaginationQueryDto) {
    return this.platformAdminService.listOrganizations(query);
  }

  @Get('organizations/:id')
  @RequireSuperAdmin()
  getOrganization(@Param('id', uuidParamPipe()) id: string) {
    return this.platformAdminService.getOrganization(id);
  }

  @Patch('organizations/:id/deactivate')
  @RequireSuperAdmin()
  deactivate(@Param('id', uuidParamPipe()) id: string) {
    return this.platformAdminService.setOrganizationActive(id, false);
  }

  @Patch('organizations/:id/reactivate')
  @RequireSuperAdmin()
  reactivate(@Param('id', uuidParamPipe()) id: string) {
    return this.platformAdminService.setOrganizationActive(id, true);
  }

  @Get('stats')
  @RequireSuperAdmin()
  getStats() {
    return this.platformAdminService.getPlatformStats();
  }

  // 25/09/2026: gian thoat cho tinh huong "to chuc chi co 1 Org Admin, khong tu cap them duoc
  // quyen MOI cho chinh vai tro cua minh" - xem chu thich chi tiet tai
  // PlatformAdminService.updateOrgRolePermissions().
  @Patch('organizations/:id/roles/:roleId/permissions')
  @RequireSuperAdmin()
  updateOrgRolePermissions(
    @CurrentUser('userId') callerId: string,
    @Param('id', uuidParamPipe()) organizationId: string,
    @Param('roleId', uuidParamPipe()) roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.platformAdminService.updateOrgRolePermissions(organizationId, roleId, dto.permissionKeys, callerId);
  }
}
