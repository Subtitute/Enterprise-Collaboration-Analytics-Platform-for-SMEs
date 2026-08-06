import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '@app/common-guard';
import { MetricsService } from './metrics.service';

/**
 * 04/08/2026: endpoint /metrics de Prometheus scrape truc tiep qua internal-net - danh dau
 * @Public() giong health.controller.ts vi Prometheus khong co JWT/internal-secret header
 * (Technical_Spec.md muc 15). Content-Type co dinh theo dung dinh dang OpenMetrics text ma
 * prom-client tra ve (Registry.contentType), khong doi giua cac ban prom-client cung major.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): Promise<string> {
    return this.metrics.getMetricsText();
  }
}