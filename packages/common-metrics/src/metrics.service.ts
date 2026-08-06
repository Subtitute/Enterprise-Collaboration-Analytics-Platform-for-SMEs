import { Injectable, OnModuleInit } from '@nestjs/common';
import { Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * 04/08/2026: Registry rieng cho tung service (khong dung registry mac dinh toan cuc cua
 * prom-client) - moi service Node la 1 process rieng nen khong co rui ro trung metric giua
 * cac service, nhung Registry rieng giup test de mock/reset hon (Technical_Spec.md muc 15).
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Thoi gian xu ly HTTP request (giay), gan nhan method/route/status_code',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });
  }

  getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}