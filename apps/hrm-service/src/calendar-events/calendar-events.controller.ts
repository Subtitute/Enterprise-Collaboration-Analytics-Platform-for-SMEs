import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@app/common-guard';
import { CalendarEventsService } from './calendar-events.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { CalendarEventQueryDto } from './dto/calendar-event-query.dto';

/**
 * Lich cong ty - Technical_Spec.md "Lich cong ty".
 *
 * 03/10/2026: mo rong phan quyen - KHONG con @RequirePermissions() o muc route cho ca 4 endpoint
 * (truoc day ca 4 deu doi hoi CALENDAR_MANAGE, chi Org Admin xem/sua duoc). Gio: xem (GET) mo cho
 * MOI thanh vien da dang nhap; tao (POST) mo cho moi thanh vien VOI su kien thuong (EVENT), rieng
 * ngay nghi le (HOLIDAY) doi hoi CALENDAR_MANAGE - dieu kien nay phu thuoc BODY (dto.type) nen
 * khong the khai bao tinh (static) bang decorator, phai kiem tra NGAY TRONG service; sua/xoa (PATCH/
 * DELETE) phu thuoc ca chu so huu LAN tham quyen tuong doi giua nguoi goi/nguoi tao - cung phai
 * kiem tra trong service. Xem chu thich day du tai CalendarEventsService.
 */
@ApiTags('CalendarEvents')
@ApiBearerAuth()
@Controller('calendar-events')
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Post()
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('permissions') permissions: string[],
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendarEventsService.create(organizationId, userId, permissions, dto);
  }

  /** 03/10/2026: mo cho moi thanh vien to chuc da dang nhap - khong con doi hoi CALENDAR_MANAGE. */
  @Get()
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: CalendarEventQueryDto) {
    return this.calendarEventsService.findAll(organizationId, query);
  }

  @Patch(':id')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('permissions') permissions: string[],
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendarEventsService.update(organizationId, userId, permissions, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('permissions') permissions: string[],
    @Param('id') id: string,
  ) {
    return this.calendarEventsService.delete(organizationId, userId, permissions, id);
  }
}
