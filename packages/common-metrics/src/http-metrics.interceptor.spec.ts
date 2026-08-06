import { of, throwError } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsService } from './metrics.service';

function createContext(req: unknown, res: unknown): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
}

describe('HttpMetricsInterceptor', () => {
  let metrics: MetricsService;
  let interceptor: HttpMetricsInterceptor;

  beforeEach(() => {
    metrics = new MetricsService();
    interceptor = new HttpMetricsInterceptor(metrics);
  });

  it('ghi nhan http_request_duration_seconds voi label route theo pattern (khong phai URL that co id)', (done) => {
    const req = { method: 'GET', path: '/tasks/abc-123', route: { path: '/tasks/:id' } };
    const res = { statusCode: 200 };
    const handler: CallHandler = { handle: () => of('ok') };

    interceptor.intercept(createContext(req, res), handler).subscribe(async () => {
      const text = await metrics.getMetricsText();
      expect(text).toContain('route="/tasks/:id"');
      expect(text).toContain('method="GET"');
      expect(text).toContain('status_code="200"');
      done();
    });
  });

  it('van ghi nhan metric khi request loi, khong nuot loi cua stream goc', (done) => {
    const req = { method: 'POST', path: '/tasks', route: { path: '/tasks' } };
    const res = { statusCode: 500 };
    const handler: CallHandler = { handle: () => throwError(() => new Error('boom')) };

    interceptor.intercept(createContext(req, res), handler).subscribe({
      error: async (err) => {
        expect(err.message).toBe('boom');
        const text = await metrics.getMetricsText();
        expect(text).toContain('status_code="500"');
        done();
      },
    });
  });

  it('bo qua context khong phai http (vd RPC/WS) - khong nem loi', () => {
    const handler: CallHandler = { handle: () => of('x') };
    const ctx = { getType: () => 'rpc' } as unknown as ExecutionContext;
    expect(() => interceptor.intercept(ctx, handler)).not.toThrow();
  });
});