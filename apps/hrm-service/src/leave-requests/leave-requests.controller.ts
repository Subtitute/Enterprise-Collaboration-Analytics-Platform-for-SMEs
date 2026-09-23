import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto';
import { LeaveRequestQueryDto } from './dto/leave-request-query.dto';

/** Nghi phep - Technical_Spec.md muc 17, Wireframe.md muc 13. */
@ApiTags('LeaveRequests')
@ApiBearerAuth()
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_CREATE)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leaveRequestsService.create(organizationId, userId, dto);
  }

  /** Lich su nghi phep cua chinh nguoi goi - khong yeu cau permission dac biet, mirror trang Ho so ca nhan. */
  @Get('me')
  findMine(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @Query() query: LeaveRequestQueryDto,
  ) {
    return this.leaveRequestsService.findMine(organizationId, userId, query);
  }

  /** 22/09/2026: so du phep nam hien tai cua chinh nguoi goi - khong yeu cau permission dac biet. */
  @Get('me/balance')
  getMyBalance(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.leaveRequestsService.getMyBalance(organizationId, userId);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_VIEW)
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: LeaveRequestQueryDto) {
    return this.leaveRequestsService.findAll(organizationId, query);
  }

  @Patch(':id/approve')
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_APPROVE)
  approve(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') approverId: string,
    @Param('id') id: string,
    @Body() dto: DecideLeaveRequestDto,
  ) {
    return this.leaveRequestsService.approve(organizationId, id, approverId, dto);
  }

  @Patch(':id/reject')
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST_APPROVE)
  reject(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') approverId: string,
    @Param('id') id: string,
    @Body() dto: DecideLeaveRequestDto,
  ) {
    return this.leaveRequestsService.reject(organizationId, id, approverId, dto);
  }
}
