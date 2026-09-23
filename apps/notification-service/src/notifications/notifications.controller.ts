import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@app/common-guard';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    // 23/09/2026: pham vi hien thi (to chuc/phong ban/ca nhan) suy ra tu permissions cua nguoi
    // goi - xem NotificationsService.resolveVisibleUserIds().
    @CurrentUser('permissions') permissions: string[],
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.findForUser(organizationId, userId, permissions, query);
  }

  // Khai bao TRUOC ':id/read' de tranh nham lan - du Nest phan biet duoc theo so segment
  // ('read-all' la 1 segment, ':id/read' la 2 segment) nen thu tu khong bat buoc, nhung
  // giu ro rang cho de doc.
  @Patch('read-all')
  markAllAsRead(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.notificationsService.markAllAsRead(organizationId, userId);
  }

  @Patch(':id/read')
  markAsRead(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(organizationId, userId, id);
  }
}
