import { createHttpMetricsMiddleware } from './http-metrics.middleware';
import { MetricsService } from './metrics.service';

function createRes() {
  const listeners: Record<string, () => void> = {};
  return {
    statusCode: 200,
    on: (event: string, cb: () => void) => {
      listeners[event] = cb;
    },
    finish: () => listeners.finish?.(),
  };
}

describe('createHttpMetricsMiddleware', () => {
  it('rut gon duong dan proxy ve toi da 3 doan de tranh bung no cardinality', async () => {
    const metrics = new MetricsService();
    const middleware = createHttpMetricsMiddleware(metrics);
    const req = { method: 'GET', path: '/api/v1/projects/uuid-that/tasks' } as any;
    const res = createRes();

    middleware(req, res as any, () => {});
    res.finish();

    const text = await metrics.getMetricsText();
    expect(text).toContain('route="/api/v1/projects"');
  });

  it('bo qua duong dan nam trong excludePaths (da duoc Nest interceptor ghi nhan roi)', async () => {
    const metrics = new MetricsService();
    const middleware = createHttpMetricsMiddleware(metrics, ['/api/v1/health']);
    const req = { method: 'GET', path: '/api/v1/health' } as any;
    const res = createRes();
    let nextCalled = false;

    middleware(req, res as any, () => {
      nextCalled = true;
    });
    res.finish();

    expect(nextCalled).toBe(true);
    const text = await metrics.getMetricsText();
    expect(text).not.toContain('route="/api/v1/health"');
  });
});