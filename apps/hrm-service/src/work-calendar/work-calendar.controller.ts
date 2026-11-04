import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { WorkCalendarService } from './work-calendar.service';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';
import { WorkingDaysQueryDto } from './dto/working-days-query.dto';

/** 04/11/2026: lich lam viec cua to chuc va cach dem ngay lam viec. */
@ApiTags('WorkCalendar')
@ApiBearerAuth()
@Controller('work-calendar')
export class WorkCalendarController {
  constructor(private readonly workCalendarService: WorkCalendarService) {}

  /** Moi thanh vien deu can biet gio lam va ngay lam cua cong ty. */
  @Get('schedule')
  getSchedule(@CurrentUser('organizationId') organizationId: string) {
    return this.workCalendarService.getSchedule(organizationId);
  }

  @Put('schedule')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  updateSchedule(@CurrentUser('organizationId') organizationId: string, @Body() dto: UpdateWorkScheduleDto) {
    return this.workCalendarService.updateSchedule(organizationId, dto);
  }

  @Get('working-days')
  getWorkingDays(@CurrentUser('organizationId') organizationId: string, @Query() query: WorkingDaysQueryDto) {
    return this.workCalendarService.summarizeRange(organizationId, query.startDate, query.endDate);
  }
}
