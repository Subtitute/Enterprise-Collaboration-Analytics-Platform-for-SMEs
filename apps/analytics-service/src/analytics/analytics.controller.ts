import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { AnalyticsService } from './analytics.service';
import { TaskTrendQueryDto } from './dto/task-trend-query.dto';
import { TaskStatusBreakdownQueryDto } from './dto/task-status-breakdown-query.dto';
import { DocumentActivityQueryDto } from './dto/document-activity-query.dto';

/**
 * REST API cho Dashboard tong quan (Wireframe.md muc 3) va trang Bao cao & Phan tich
 * (Wireframe.md muc 7). Moi endpoint yeu cau permission `analytics:view` va tu dong loc
 * theo organizationId cua nguoi goi (multi-tenant - Technical_Spec.md muc 1, muc 6).
 */
@ApiTags('Analytics')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.ANALYTICS_VIEW)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ApiOperation({ summary: 'KPI tong quan cho Dashboard: tong task, ty le hoan thanh, tai lieu moi, thanh vien hoat dong' })
  @Get('summary')
  getSummary(@CurrentUser('organizationId') organizationId: string) {
    return this.analyticsService.getSummary(organizationId);
  }

  @ApiOperation({ summary: 'Xu huong tao/hoan thanh task theo thoi gian (7 ngay/30 ngay/quy)' })
  @Get('task-trend')
  getTaskTrend(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: TaskTrendQueryDto,
  ) {
    return this.analyticsService.getTaskTrend(organizationId, query.range ?? '7d');
  }

  @ApiOperation({ summary: 'So luong task theo trang thai HIEN TAI (TODO/DOING/DONE), tuy chon loc theo du an' })
  @Get('task-status-breakdown')
  getTaskStatusBreakdown(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: TaskStatusBreakdownQueryDto,
  ) {
    return this.analyticsService.getTaskStatusBreakdown(organizationId, query.projectId);
  }

  @ApiOperation({ summary: 'Hoat dong tai lieu theo ngay (tai len/chia se) - 7 ngay hoac 30 ngay' })
  @Get('document-activity')
  getDocumentActivity(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: DocumentActivityQueryDto,
  ) {
    return this.analyticsService.getDocumentActivity(organizationId, query.range ?? '7d');
  }

  @ApiOperation({
    summary:
      'Tien do hoan thanh theo tung du an. CHI tra ve projectId (UUID) - frontend tu ghep ten du an qua Project-Task Service',
  })
  @Get('project-progress')
  getProjectProgress(@CurrentUser('organizationId') organizationId: string) {
    return this.analyticsService.getProjectProgress(organizationId);
  }

  @ApiOperation({
    summary:
      'Feed hoat dong tho gan nhat (toi da 20 ban ghi). CHI tra ve actorId (UUID) - frontend tu resolve ten nguoi dung',
  })
  @Get('recent-activity')
  getRecentActivity(@CurrentUser('organizationId') organizationId: string) {
    return this.analyticsService.getRecentActivity(organizationId);
  }
}
