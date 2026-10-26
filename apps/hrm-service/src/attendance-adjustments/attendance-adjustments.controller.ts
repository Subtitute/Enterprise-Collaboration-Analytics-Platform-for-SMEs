import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { AuthContext, PERMISSIONS } from '@app/common-dto';
// 26/10/2026: ngu canh nguoi goi cho pham vi xem/duyet theo phong ban (xem src/user-directory).
import { toScopeCaller } from '../user-directory/user-directory';
import { AttendanceAdjustmentsService } from './attendance-adjustments.service';
import { CreateAttendanceAdjustmentDto } from './dto/create-attendance-adjustment.dto';
import { DecideAttendanceAdjustmentDto } from './dto/decide-attendance-adjustment.dto';
import { AttendanceAdjustmentQueryDto } from './dto/attendance-adjustment-query.dto';

/** Giai trinh/duyet cham cong - HRM-lite mo rong (bo sung 22/09/2026). */
@ApiTags('AttendanceAdjustments')
@ApiBearerAuth()
@Controller('attendance-adjustments')
export class AttendanceAdjustmentsController {
  constructor(private readonly attendanceAdjustmentsService: AttendanceAdjustmentsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_ADJUSTMENT_CREATE)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateAttendanceAdjustmentDto,
  ) {
    return this.attendanceAdjustmentsService.create(organizationId, userId, dto);
  }

  /** Lich su giai trinh cua chinh nguoi goi - khong yeu cau permission dac biet, mirror LeaveRequestsController. */
  @Get('me')
  findMine(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @Query() query: AttendanceAdjustmentQueryDto,
  ) {
    return this.attendanceAdjustmentsService.findMine(organizationId, userId, query);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_ADJUSTMENT_VIEW)
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: AttendanceAdjustmentQueryDto, @CurrentUser() caller: AuthContext) {
    return this.attendanceAdjustmentsService.findAll(organizationId, query, toScopeCaller(caller));
  }

  @Patch(':id/approve')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_ADJUSTMENT_APPROVE)
  approve(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') approverId: string,
    @Param('id') id: string,
    @Body() dto: DecideAttendanceAdjustmentDto,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.attendanceAdjustmentsService.approve(organizationId, id, approverId, dto, toScopeCaller(caller));
  }

  @Patch(':id/reject')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_ADJUSTMENT_APPROVE)
  reject(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') approverId: string,
    @Param('id') id: string,
    @Body() dto: DecideAttendanceAdjustmentDto,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.attendanceAdjustmentsService.reject(organizationId, id, approverId, dto, toScopeCaller(caller));
  }
}
