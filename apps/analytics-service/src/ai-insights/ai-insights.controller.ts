import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { AiInsightsService } from './ai-insights.service';
import { AiInsightQueryDto } from './dto/ai-insight-query.dto';

/**
 * 28/07/2026: endpoint rieng cho tinh nang "Nhan xet AI" (GET /analytics/ai-insights) - tach
 * controller rieng khoi AnalyticsController (mau tham chieu: failed-events tach rieng khoi
 * notifications trong notification-service) du CUNG prefix route 'analytics'. Dung lai dung
 * permission `analytics:view` nhu cac endpoint KPI khac - day chi la 1 lop dien giai (narration)
 * tren so lieu nguoi dung DA CO QUYEN xem, khong phai du lieu/quyen moi.
 */
@ApiTags('Analytics')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.ANALYTICS_VIEW)
@Controller('analytics')
export class AiInsightsController {
  constructor(private readonly aiInsightsService: AiInsightsService) {}

  @ApiOperation({
    summary:
      'Quet KPI toan to chuc + tung phong ban + top du an, AI (Gemini/Groq) xep hang va tra ve 2-4 insight co cau truc dang chu y nhat (theo yeu cau, co cache 30 phut)',
  })
  @Get('ai-insights')
  getAiInsights(@CurrentUser('organizationId') organizationId: string, @Query() query: AiInsightQueryDto) {
    return this.aiInsightsService.generateInsights(organizationId, query.range ?? '7d');
  }
}
