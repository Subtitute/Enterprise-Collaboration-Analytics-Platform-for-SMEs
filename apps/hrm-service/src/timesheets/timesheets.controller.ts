import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { AuthContext, PERMISSIONS } from '@app/common-dto';
import { toScopeCaller } from '../user-directory/user-directory';
import { TimesheetsService } from './timesheets.service';
import {
  LockTimesheetPeriodDto,
  TimesheetExceptionsQueryDto,
  TimesheetMonthQueryDto,
  UnlockTimesheetPeriodDto,
  UpsertTimesheetEntryDto,
} from './dto/timesheet.dto';

/** 04/11/2026: bang cong theo thang, dong sua tay, khoa/mo khoa ky cong va ngoai le. */
@ApiTags('Timesheets')
@ApiBearerAuth()
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  getMonth(@CurrentUser('organizationId') organizationId: string, @Query() query: TimesheetMonthQueryDto, @CurrentUser() caller: AuthContext) {
    return this.timesheetsService.getMonth(organizationId, query.month, toScopeCaller(caller));
  }

  @Get('exceptions')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  getExceptions(@CurrentUser('organizationId') organizationId: string, @Query() query: TimesheetExceptionsQueryDto, @CurrentUser() caller: AuthContext) {
    return this.timesheetsService.getExceptions(organizationId, query, toScopeCaller(caller));
  }

  @Get('users/:userId')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  getUserMonth(
    @CurrentUser('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Query() query: TimesheetMonthQueryDto,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.timesheetsService.getUserMonth(organizationId, userId, query.month, toScopeCaller(caller));
  }

  @Put('entries')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_ADJUSTMENT_APPROVE)
  upsertEntry(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Body() dto: UpsertTimesheetEntryDto,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.timesheetsService.upsertEntry(organizationId, actorId, dto, toScopeCaller(caller));
  }

  @Delete('entries/:userId/:workDate')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_ADJUSTMENT_APPROVE)
  deleteEntry(
    @CurrentUser('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Param('workDate') workDate: string,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.timesheetsService.deleteEntry(organizationId, userId, workDate, toScopeCaller(caller));
  }

  @Post(':month/lock')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  lock(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('month') month: string,
    @Body() dto: LockTimesheetPeriodDto,
  ) {
    return this.timesheetsService.lock(organizationId, month, actorId, dto);
  }

  @Post(':month/unlock')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  unlock(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('month') month: string,
    @Body() dto: UnlockTimesheetPeriodDto,
  ) {
    return this.timesheetsService.unlock(organizationId, month, actorId, dto);
  }
}
