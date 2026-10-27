import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { AuthContext, PERMISSIONS } from '@app/common-dto';
import { AnalyticsCaller, AnalyticsService } from './analytics.service';
import { TaskTrendQueryDto } from './dto/task-trend-query.dto';
import { TaskStatusBreakdownQueryDto } from './dto/task-status-breakdown-query.dto';
import { DocumentActivityQueryDto } from './dto/document-activity-query.dto';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { ProjectProgressQueryDto } from './dto/project-progress-query.dto';
import { DrillDownQueryDto } from './dto/drill-down-query.dto';
import { ProductSalesTrendQueryDto } from './dto/product-sales-trend-query.dto';
import { TopProductsQueryDto } from './dto/top-products-query.dto';

/** 26/10/2026: ngu canh nguoi goi cho pham vi phong ban (xem AnalyticsService.resolveDepartmentScope()). */
function toCaller(user: AuthContext): AnalyticsCaller {
  return { userId: user.userId, permissions: user.permissions ?? [], departmentId: user.departmentId ?? null };
}

/**
 * REST API cho Dashboard tong quan (Wireframe.md muc 3) va trang Bao cao & Phan tich
 * (Wireframe.md muc 7). Moi endpoint yeu cau permission `analytics:view` va tu dong loc
 * theo organizationId cua nguoi goi (multi-tenant - Technical_Spec.md muc 1, muc 6).
 *
 * 26/10/2026: moi endpoint KPI nay di qua resolveDepartmentScope() - Org Admin xem toan to chuc
 * (tuy chon loc 1 phong ban), Manager CHI xem so lieu phong ban cua minh (mac dinh khi khong truyen
 * departmentId; truyen phong ban khac -> 403). Truoc ngay nay Manager xem duoc so lieu toan to chuc
 * va cua bat ky phong ban nao giong het Org Admin.
 */
@ApiTags('Analytics')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.ANALYTICS_VIEW)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ApiOperation({
    summary:
      'KPI tong quan cho Dashboard: tong task, ty le hoan thanh, tai lieu moi, thanh vien hoat dong (loc theo range=7d|30d|quarter, tuy chon loc theo departmentId)',
  })
  @Get('summary')
  async getSummary(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: SummaryQueryDto,
    @CurrentUser() user: AuthContext,
  ) {
    // 28/07/2026: thread them query.departmentId (tuy chon) - xem AnalyticsService.computeSummary().
    const departmentId = await this.analyticsService.resolveDepartmentScope(organizationId, toCaller(user), query.departmentId);
    return this.analyticsService.getSummary(organizationId, query.range ?? '7d', departmentId);
  }

  @ApiOperation({ summary: 'Xu huong tao/hoan thanh task theo thoi gian (7 ngay/30 ngay/quy)' })
  @Get('task-trend')
  async getTaskTrend(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: TaskTrendQueryDto,
    @CurrentUser() user: AuthContext,
  ) {
    const departmentId = await this.analyticsService.resolveDepartmentScope(organizationId, toCaller(user));
    return this.analyticsService.getTaskTrend(organizationId, query.range ?? '7d', departmentId);
  }

  @ApiOperation({
    summary:
      'So luong task theo trang thai HIEN TAI (TODO/DOING/DONE), tuy chon loc theo du an, theo phong ban (departmentId) va theo range=7d|30d|quarter',
  })
  @Get('task-status-breakdown')
  async getTaskStatusBreakdown(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: TaskStatusBreakdownQueryDto,
    @CurrentUser() user: AuthContext,
  ) {
    // 28/07/2026: thread them query.departmentId (tuy chon) - xem AnalyticsService.getTaskStatusBreakdown().
    const departmentId = await this.analyticsService.resolveDepartmentScope(organizationId, toCaller(user), query.departmentId);
    return this.analyticsService.getTaskStatusBreakdown(organizationId, query.range ?? '7d', query.projectId, departmentId);
  }

  @ApiOperation({ summary: 'Hoat dong tai lieu theo ngay (tai len/chia se) - 7 ngay hoac 30 ngay' })
  @Get('document-activity')
  async getDocumentActivity(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: DocumentActivityQueryDto,
    @CurrentUser() user: AuthContext,
  ) {
    const departmentId = await this.analyticsService.resolveDepartmentScope(organizationId, toCaller(user));
    return this.analyticsService.getDocumentActivity(organizationId, query.range ?? '7d', departmentId);
  }

  // 15/10/2026: Inventory Service (Danh muc san pham + Kho) - phan tich xu huong thi truong,
  // Technical_Spec.md muc 22.
  @ApiOperation({ summary: 'Xu huong ban hang theo ngay (so luong + doanh thu, gop toan bo danh muc/san pham) - 7 ngay hoac 30 ngay' })
  @Get('product-sales-trend')
  async getProductSalesTrend(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: ProductSalesTrendQueryDto,
    @CurrentUser() user: AuthContext,
  ) {
    const departmentId = await this.analyticsService.resolveDepartmentScope(organizationId, toCaller(user));
    return this.analyticsService.getProductSalesTrend(organizationId, query.range ?? '7d', departmentId);
  }

  @ApiOperation({ summary: 'San pham ban chay nhat theo doanh thu trong khoang thoi gian (range=7d|30d, limit mac dinh 5, toi da 20)' })
  @Get('top-products')
  async getTopProducts(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: TopProductsQueryDto,
    @CurrentUser() user: AuthContext,
  ) {
    const departmentId = await this.analyticsService.resolveDepartmentScope(organizationId, toCaller(user));
    return this.analyticsService.getTopProducts(organizationId, query.range ?? '7d', query.limit ?? 5, departmentId);
  }

  @ApiOperation({
    summary:
      'Tien do hoan thanh theo tung du an (loc theo range=7d|30d|quarter, tuy chon loc theo departmentId). CHI tra ve projectId (UUID) - frontend tu ghep ten du an qua Project-Task Service',
  })
  @Get('project-progress')
  async getProjectProgress(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: ProjectProgressQueryDto,
    @CurrentUser() user: AuthContext,
  ) {
    // 28/07/2026: thread them query.departmentId (tuy chon) - xem AnalyticsService.getProjectProgress().
    const departmentId = await this.analyticsService.resolveDepartmentScope(organizationId, toCaller(user), query.departmentId);
    return this.analyticsService.getProjectProgress(organizationId, query.range ?? '7d', departmentId);
  }

  @ApiOperation({
    summary:
      'Feed hoat dong tho gan nhat (toi da 20 ban ghi). CHI tra ve actorId (UUID) - frontend tu resolve ten nguoi dung. ' +
      'Pham vi hien thi theo cap do nguoi goi: Org Admin (toan to chuc), Manager (phong ban minh thuoc ve/phu trach), con lai (chinh minh).',
  })
  @Get('recent-activity')
  getRecentActivity(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('permissions') permissions: string[],
    @CurrentUser('departmentId') departmentId: string | null,
  ) {
    return this.analyticsService.getRecentActivity(organizationId, userId, permissions, departmentId ?? null);
  }

  @ApiOperation({
    summary:
      'Layer 2 Diagnostic: chi tiet "vi sao" cho 1 phong ban/du an cu the (tong task, chua xong, qua han, nguoi tap trung nhieu task chua xong nhat). ' +
      'Pham vi truy cap: Org Admin xem duoc moi scope, Manager chi xem scope=department cua phong ban minh va scope=project gioi han task cua phong ban minh.',
  })
  @Get('drill-down')
  getDrillDown(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('permissions') permissions: string[],
    @Query() query: DrillDownQueryDto,
    @CurrentUser('departmentId') departmentId: string | null,
  ) {
    return this.analyticsService.getDrillDown(
      organizationId,
      query.scope,
      query.scopeId,
      query.range ?? '7d',
      userId,
      permissions,
      departmentId ?? null,
    );
  }
}
