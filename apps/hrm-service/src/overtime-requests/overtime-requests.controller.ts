import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { OvertimeRequestsService } from './overtime-requests.service';
import { CreateOvertimeRequestDto } from './dto/create-overtime-request.dto';
import { DecideOvertimeRequestDto } from './dto/decide-overtime-request.dto';
import { OvertimeRequestQueryDto } from './dto/overtime-request-query.dto';

/** Dang ky/duyet tang ca (OT) - HRM-lite mo rong (bo sung 22/09/2026). */
@ApiTags('OvertimeRequests')
@ApiBearerAuth()
@Controller('overtime-requests')
export class OvertimeRequestsController {
  constructor(private readonly overtimeRequestsService: OvertimeRequestsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.OVERTIME_REQUEST_CREATE)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateOvertimeRequestDto,
  ) {
    return this.overtimeRequestsService.create(organizationId, userId, dto);
  }

  /** Lich su dang ky OT cua chinh nguoi goi - khong yeu cau permission dac biet, mirror LeaveRequestsController. */
  @Get('me')
  findMine(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @Query() query: OvertimeRequestQueryDto,
  ) {
    return this.overtimeRequestsService.findMine(organizationId, userId, query);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.OVERTIME_REQUEST_VIEW)
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: OvertimeRequestQueryDto) {
    return this.overtimeRequestsService.findAll(organizationId, query);
  }

  @Patch(':id/approve')
  @RequirePermissions(PERMISSIONS.OVERTIME_REQUEST_APPROVE)
  approve(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') approverId: string,
    @Param('id') id: string,
    @Body() dto: DecideOvertimeRequestDto,
  ) {
    return this.overtimeRequestsService.approve(organizationId, id, approverId, dto);
  }

  @Patch(':id/reject')
  @RequirePermissions(PERMISSIONS.OVERTIME_REQUEST_APPROVE)
  reject(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') approverId: string,
    @Param('id') id: string,
    @Body() dto: DecideOvertimeRequestDto,
  ) {
    return this.overtimeRequestsService.reject(organizationId, id, approverId, dto);
  }
}
