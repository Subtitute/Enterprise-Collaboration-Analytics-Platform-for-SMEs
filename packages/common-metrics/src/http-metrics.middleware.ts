import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * 04/08/2026: middleware Express thuan (khong phai Nest interceptor), danh rieng cho Gateway.
 * Cac route nghiep vu o Gateway di qua http-proxy-middleware, KHONG qua pipeline Nest nen
 * HttpMetricsInterceptor khong bat duoc luu luong nay - gan middleware nay vao app.use()
 * TRUOC khi setupGateway() dang ky proxy (xem apps/gateway/src/main.ts).
 *
 * Rut gon duong dan ve toi da 3 doan (vd '/api/v1/projects/uuid-that/tasks' ->
 * '/api/v1/projects') de tranh bung no cardinality label do id/UUID that trong duong dan proxy -
 * Gateway khong co route pattern "sach" nhu req.route.path cua mot Nest controller thuc su.
 */
/**
 * `excludePaths` - duong dan Nest controller rieng cua Gateway (vd '/api/v1/health',
 * '/api/v1/metrics') da duoc HttpMetricsInterceptor ghi nhan roi (2 controller do van chay
 * qua pipeline Nest binh thuong, chi cac route PROXY moi bo qua Nest) - loai tru o day de
 * tranh ghi nhan trung 2 lan cho cung 1 request.
 */
export function createHttpMetricsMiddleware(metrics: MetricsService, excludePaths: string[] = []) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (excludePaths.includes(req.path)) return next();

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      metrics.httpRequestDuration.observe(
        { method: req.method, route: bucketPath(req.path), status_code: String(res.statusCode) },
        durationSeconds,
      );
    });
    next();
  };
}

function bucketPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return '/' + segments.slice(0, 3).join('/');
}