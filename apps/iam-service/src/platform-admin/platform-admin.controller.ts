import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireSuperAdmin } from '@app/common-guard';
import { PaginationQueryDto } from '@app/common-dto';
import { PlatformAdminService } from './platform-admin.service';
import { uuidParamPipe } from '../common/uuid-param.pipe';

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
}
