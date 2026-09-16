import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { CalendarEventsService } from './calendar-events.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CalendarEventQueryDto } from './dto/calendar-event-query.dto';

/**
 * Lich cong ty - Technical_Spec.md "Lich cong ty". Ca 4 route deu doi hoi PERMISSIONS.CALENDAR_MANAGE
 * (chi Org Admin, xem permission.enum.ts) - khong tach quyen xem rieng vi trang nay chi dat trong
 * khu vuc Quan tri (frontend `ProtectedRoute requireAdmin`), xem chu thich tai khai bao permission.
 */
@ApiTags('CalendarEvents')
@ApiBearerAuth()
@Controller('calendar-events')
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.CALENDAR_MANAGE)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendarEventsService.create(organizationId, userId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.CALENDAR_MANAGE)
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: CalendarEventQueryDto) {
    return this.calendarEventsService.findAll(organizationId, query);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CALENDAR_MANAGE)
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendarEventsService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CALENDAR_MANAGE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.calendarEventsService.delete(organizationId, id, userId);
  }
}
