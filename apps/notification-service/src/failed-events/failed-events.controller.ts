import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { FailedEventsService } from './failed-events.service';
import { ListFailedEventsQueryDto } from './dto/list-failed-events-query.dto';

/**
 * 28/07/2026: man hinh quan tri "Danh sach su kien loi" (Technical_Spec.md muc 14 - nang cap
 * Dead Letter Queue) - CHI Org Admin (PERMISSIONS.SYSTEM_MANAGE, xem packages/common-dto/src/
 * enums/permission.enum.ts) duoc xem, vi day la moi quan tam van hanh/ha tang chu khong phai
 * nghiep vu. @RequirePermissions duoc PermissionsGuard kiem tra (da dang ky global qua APP_GUARD
 * trong app.module.ts) - day la LAN DAU TIEN duoc dung thuc te trong notification-service (truoc
 * do guard nay chi la no-op cho service nay vi chua co route nao khai bao @RequirePermissions).
 */
@ApiTags('Failed Events')
@ApiBearerAuth()
@Controller('failed-events')
export class FailedEventsController {
  constructor(private readonly failedEventsService: FailedEventsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SYSTEM_MANAGE)
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: ListFailedEventsQueryDto,
  ) {
    return this.failedEventsService.findForOrganization(organizationId, query);
  }
}
