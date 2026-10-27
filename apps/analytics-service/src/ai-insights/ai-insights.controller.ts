import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { AuthContext, PERMISSIONS } from '@app/common-dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { AiInsightsService } from './ai-insights.service';
import { AiInsightQueryDto } from './dto/ai-insight-query.dto';
import { GenerateInsightsDto } from './dto/generate-insights.dto';

/**
 * 28/07/2026: endpoint rieng cho tinh nang "Nhan xet AI" (GET /analytics/ai-insights) - tach
 * controller rieng khoi AnalyticsController (mau tham chieu: failed-events tach rieng khoi
 * notifications trong notification-service) du CUNG prefix route 'analytics'. Dung lai dung
 * permission `analytics:view` nhu cac endpoint KPI khac - day chi la 1 lop dien giai (narration)
 * tren so lieu nguoi dung DA CO QUYEN xem, khong phai du lieu/quyen moi.
 *
 * 26/10/2026: cung pham vi phong ban voi moi KPI khac (AnalyticsService.resolveDepartmentScope()) -
 * Org Admin quet toan to chuc nhu cu, Manager CHI quet phong ban cua minh.
 */
@ApiTags('Analytics')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.ANALYTICS_VIEW)
@Controller('analytics')
export class AiInsightsController {
  constructor(
    private readonly aiInsightsService: AiInsightsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /** 26/10/2026: undefined = toan to chuc (Org Admin), nguoc lai la phong ban cua Manager. */
  private resolveScope(organizationId: string, user: AuthContext): Promise<string | undefined> {
    return this.analyticsService.resolveDepartmentScope(organizationId, {
      userId: user.userId,
      permissions: user.permissions ?? [],
      departmentId: user.departmentId ?? null,
    });
  }

  @ApiOperation({
    summary:
      'Quet KPI toan to chuc + tung phong ban + top du an (Manager: chi phong ban minh + du an), AI (Gemini/Groq) xep hang va tra ve 2-4 insight co cau truc dang chu y nhat (theo yeu cau, co cache 30 phut)',
  })
  @Get('ai-insights')
  async getAiInsights(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: AiInsightQueryDto,
    @CurrentUser() user: AuthContext,
  ) {
    const scopeDepartmentId = await this.resolveScope(organizationId, user);
    return this.aiInsightsService.generateInsights(organizationId, query.range ?? '7d', [], scopeDepartmentId);
  }

  @ApiOperation({
    summary:
      'Nhu GET /analytics/ai-insights, cong them: nhan ket qua Phat hien bat thuong (POST /ml/anomalies, frontend tu goi truoc) de AI de xuat them "Ke hoach hanh dong" (actionPlan) cho tung insight co lien quan - Layer 5 Recommendation Engine',
  })
  @Post('ai-insights')
  async generateInsightsWithActionPlan(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: GenerateInsightsDto,
    @CurrentUser() user: AuthContext,
  ) {
    const scopeDepartmentId = await this.resolveScope(organizationId, user);
    return this.aiInsightsService.generateInsights(organizationId, dto.range ?? '7d', dto.anomalies ?? [], scopeDepartmentId);
  }
}
