import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { createRateLimitMiddleware } from './rate-limit.middleware';
import * as sendErrorResponseModule from '../common/send-error-response';

jest.mock('../common/send-error-response');

/**
 * 22/08/2026: file nay truoc do KHONG TON TAI - createRateLimitMiddleware() chi duoc kiem tra
 * gian tiep qua rate-limit.util.spec.ts (cac ham thuan ben trong). Bo sung kiem thu THAT cho
 * middleware, tap trung vao hanh vi fail-open moi sua (xem chu thich RATE_LIMIT_TIMEOUT_MS trong
 * rate-limit.middleware.ts) - phat hien qua kiem thu thuc te khi lam health check cho Gateway.
 */
describe('createRateLimitMiddleware', () => {
  function buildReqRes() {
    const req = {
      headers: {},
      socket: { remoteAddress: '1.2.3.4' },
      originalUrl: '/api/v1/tasks',
    } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();
    return { req, res, next };
  }

  // 24/10/2026: tach 2 nguong - rateLimit.max (theo nguoi dung da xac thuc) va rateLimit.anonymousMax
  // (theo IP, chua xac thuc). Request trong buildReqRes() khong co req.user -> dung anonymousMax.
  const CONFIG: Record<string, number> = { 'rateLimit.max': 300, 'rateLimit.anonymousMax': 100, 'rateLimit.windowSeconds': 60 };
  function buildConfigService(): ConfigService {
    return { get: jest.fn((key: string) => CONFIG[key]) } as unknown as ConfigService;
  }

  it('da xac thuc: dem theo nguoi dung voi nguong rieng (cao hon nguong theo IP)', async () => {
    const client = { incrWithExpire: jest.fn().mockResolvedValue(150) };
    const redisService = { getClient: () => client } as never;
    const middleware = createRateLimitMiddleware(redisService, buildConfigService());
    const { req, res, next } = buildReqRes();
    (req as Request & { user?: unknown }).user = { sub: 'user-1', organizationId: 'org-1' };

    middleware(req, res, next);
    await flushMicrotasks();

    expect(client.incrWithExpire).toHaveBeenCalledWith('ratelimit:user:org-1:user-1', 60);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('chua xac thuc: 150 request/cua so vuot nguong theo IP (100) -> 429', async () => {
    const client = { incrWithExpire: jest.fn().mockResolvedValue(150) };
    const redisService = { getClient: () => client } as never;
    const middleware = createRateLimitMiddleware(redisService, buildConfigService());
    const { req, res, next } = buildReqRes();

    middleware(req, res, next);
    await flushMicrotasks();

    expect(client.incrWithExpire).toHaveBeenCalledWith('ratelimit:ip:1.2.3.4', 60);
    expect(next).not.toHaveBeenCalled();
    expect(sendErrorResponseModule.sendErrorResponse).toHaveBeenCalled();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // withTimeout() van di qua vai microtask (resolve cua Promise wrapper -> .then trong middleware)
  // hon 1-2 await Promise.resolve() co the flush dung het - dung setImmediate (macrotask) de dam
  // bao TOAN BO microtask dang cho da chay xong.
  function flushMicrotasks(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

  // 26/08/2026: incrWithExpire (Lua script EVALSHA, dang ky trong RedisService.onModuleInit()) thay
  // the incr+expire rieng biet truoc day - fix loi khong nguyen tu (xem chu thich checkRateLimit()
  // trong rate-limit.middleware.ts). Mock lai client theo dung 1 lenh Redis nay.
  it('duoi nguong: cho qua request (next() duoc goi)', async () => {
    const client = { incrWithExpire: jest.fn().mockResolvedValue(1) };
    const redisService = { getClient: () => client } as never;
    const middleware = createRateLimitMiddleware(redisService, buildConfigService());
    const { req, res, next } = buildReqRes();

    middleware(req, res, next);
    await flushMicrotasks();

    expect(next).toHaveBeenCalledTimes(1);
    expect(sendErrorResponseModule.sendErrorResponse).not.toHaveBeenCalled();
  });

  it('vuot nguong: tu choi 429 qua sendErrorResponse, KHONG goi next()', async () => {
    const client = { incrWithExpire: jest.fn().mockResolvedValue(101) };
    const redisService = { getClient: () => client } as never;
    const middleware = createRateLimitMiddleware(redisService, buildConfigService());
    const { req, res, next } = buildReqRes();

    middleware(req, res, next);
    await flushMicrotasks();

    expect(next).not.toHaveBeenCalled();
    expect(sendErrorResponseModule.sendErrorResponse).toHaveBeenCalledWith(
      res,
      429,
      'TooManyRequestsException',
      expect.any(String),
      req.originalUrl,
      expect.any(String),
      req,
    );
  });

  it('Redis tu choi ngay (mat ket noi ro rang): fail-open, van goi next()', async () => {
    const client = { incrWithExpire: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    const redisService = { getClient: () => client } as never;
    const middleware = createRateLimitMiddleware(redisService, buildConfigService());
    const { req, res, next } = buildReqRes();

    middleware(req, res, next);
    await flushMicrotasks();

    expect(next).toHaveBeenCalledTimes(1);
  });

  // 22/08/2026: day la ca kiem thu cho chinh loi vua sua - truoc ban sua, `client.incr()` khong
  // bao gio resolve/reject (mo phong hang doi lenh cua ioredis khi mat ket noi that,
  // `enableOfflineQueue: true` mac dinh) se lam middleware "treo" vo thoi han, next() KHONG BAO
  // GIO duoc goi. Dung fake timer de xac nhan sau RATE_LIMIT_TIMEOUT_MS, middleware van fail-open.
  //
  // 26/08/2026: cap nhat mock theo incrWithExpire (xem chu thich o cac test tren) - hanh vi "treo vo
  // thoi han" duoc mo phong y het, chi khac ten lenh Redis duoc goi.
  it('Redis "treo" vo thoi han (khong resolve/reject - mo phong offline queue that su): van fail-open sau timeout, KHONG treo mai', async () => {
    jest.useFakeTimers();
    // Promise KHONG BAO GIO resolve/reject (mo phong hang doi lenh cua ioredis khi mat ket noi that) - co chu dich.
    const client = { incrWithExpire: jest.fn(() => new Promise<never>(() => undefined)) };
    const redisService = { getClient: () => client } as never;
    const middleware = createRateLimitMiddleware(redisService, buildConfigService());
    const { req, res, next } = buildReqRes();

    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1000);

    expect(next).toHaveBeenCalledTimes(1);
    expect(sendErrorResponseModule.sendErrorResponse).not.toHaveBeenCalled();
  });
});
