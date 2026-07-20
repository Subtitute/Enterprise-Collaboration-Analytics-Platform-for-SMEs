import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { RolesService } from './roles.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

/** Quan tri > Vai tro & Phan quyen - Wireframe.md muc 8. */
@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(@CurrentUser('organizationId') organizationId: string) {
    return this.rolesService.findAllForOrg(organizationId);
  }

  @Get('permissions')
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Patch(':id/permissions')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  updatePermissions(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.updateRolePermissions(organizationId, roleId, dto.permissionKeys);
  }
}
