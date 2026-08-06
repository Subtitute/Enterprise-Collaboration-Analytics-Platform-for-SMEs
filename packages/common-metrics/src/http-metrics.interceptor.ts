import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * 04/08/2026: interceptor toan cuc ghi nhan http_request_duration_seconds cho MOI request
 * qua controller Nest cua service (Technical_Spec.md muc 15). Dung req.route.path (pattern,
 * vd '/tasks/:id') thay vi URL that (vd '/tasks/3f2a...') de tranh bung no cardinality label
 * do id/UUID thuc te - Prometheus se tao 1 time-series moi cho MOI gia tri label khac nhau.
 *
 * Luu y pham vi: Gateway dung http-proxy-middleware cho cac route nghiep vu (khong di qua
 * pipeline interceptor cua Nest), nen interceptor nay o Gateway chi bao phu controller Nest
 * rieng cua no (health/metrics) - xem http-metrics.middleware.ts cho metrics cua luu luong
 * proxy thuc te qua Gateway.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.record(req, res, start),
        error: () => this.record(req, res, start),
      }),
    );
  }

  private record(req: Request, res: Response, start: bigint): void {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path ?? req.path ?? 'unknown';
    this.metrics.httpRequestDuration.observe(
      { method: req.method, route, status_code: String(res.statusCode) },
      durationSeconds,
    );
  }
}