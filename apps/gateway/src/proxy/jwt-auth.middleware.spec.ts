// 25/07/2026: bo sung import de test createJwtAuthMiddleware (truoc day file nay chi test 2 ham
// thuan extractBearerToken/isPublicRoute) - xem nhom test moi o cuoi file.
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import type { JwtAccessPayload } from '@app/common-dto';
import type { RedisService } from '../redis/redis.service';
import { createJwtAuthMiddleware, extractBearerToken, isPublicRoute } from './jwt-auth.middleware';

/**
 * Unit test cho logic thuan cua middleware xac thuc JWT tren Gateway - Technical_Spec.md muc 6.
 */
describe('isPublicRoute', () => {
  it.each([
    '/api/v1/auth/register-organization',
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    // 22/07/2026 (review toan du an): logout dung refresh token (cookie httpOnly) lam credential
    // that su, khong phai access token - nguoi dung rat co the muon dang xuat dung luc access
    // token (15 phut) da het han. Gateway phai cho request nay qua ma khong doi Authorization
    // header hop le, giong het refresh - xem packages/common-dto/src/constants/public-routes.ts.
    '/api/v1/auth/logout',
    '/api/v1/health',
  ])('coi %s la route cong khai', (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  it('khop CHINH XAC, khong khop tien to', () => {
    expect(isPublicRoute('/api/v1/auth/login/extra')).toBe(false);
  });

  it('coi cac route con lai la can xac thuc', () => {
    expect(isPublicRoute('/api/v1/users')).toBe(false);
  });
});

describe('extractBearerToken', () => {
  it('tra ve token khi header dung dinh dang "Bearer <token>"', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('khong phan biet hoa/thuong tu khoa "bearer"', () => {
    expect(extractBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('tra ve null khi thieu header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('tra ve null khi sai scheme', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
  });

  it('tra ve null khi khong co token sau scheme', () => {
    expect(extractBearerToken('Bearer')).toBeNull();
  });
});

// 25/07/2026: bo sung nhom test cho createJwtAuthMiddleware - phat hien qua code review toan du
// an: nhanh xu ly SAU KHI verify JWT thanh cong (kiem tra blacklist Redis + goi next()) truoc
// day nam trong mot promise chain long nhung KHONG duoc return ra ngoai, nen bi "roi" khoi
// .catch() ngoai cung. Neu sendErrorResponse()/next() nem loi DONG BO trong nhanh do, loi tro
// thanh "unhandled promise rejection" - mac dinh Node.js (tu ban 15) la LAM SAP TOAN BO TIEN
// TRINH cho MOI nguoi dung dang ket noi chi vi MOT request loi. Nhom test cuoi cung ("KHONG tao
// unhandled promise rejection...") mo phong dung tinh huong nay va chung minh loi duoc middleware
// bat lai (tra 500 dung ErrorResponseDto) thay vi thoat ra ngoai.
describe('createJwtAuthMiddleware', () => {
  const PAYLOAD: JwtAccessPayload = {
    sub: 'user-1',
    organizationId: 'org-1',
    // 28/07/2026: bo sung departmentId - truong bat buoc tu JwtAccessPayload sau nang cap ACL/KPI
    // theo phong ban (xem auth-context.interface.ts), thieu truong nay lam tsc --noEmit that bai.
    departmentId: null,
    email: 'user@example.com',
    roles: ['member'],
    permissions: [],
  };

  function createReq(overrides: Partial<Request> = {}): Request {
    return {
      path: '/api/v1/users',
      originalUrl: '/api/v1/users',
      headers: { authorization: 'Bearer valid.token' },
      ...overrides,
    } as unknown as Request;
  }

  function createRes(): Response {
    const res = { headersSent: false } as unknown as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  function createDeps(options: { blacklisted?: boolean | Error; verifyError?: boolean } = {}) {
    const jwtService = {
      verifyAsync: options.verifyError
        ? jest.fn().mockRejectedValue(new Error('token het han'))
        : jest.fn().mockResolvedValue(PAYLOAD),
    } as unknown as JwtService;
    const configService = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;
    const isUserBlacklisted =
      options.blacklisted instanceof Error
        ? jest.fn().mockRejectedValue(options.blacklisted)
        : jest.fn().mockResolvedValue(options.blacklisted ?? false);
    const redisService = { isUserBlacklisted } as unknown as RedisService;
    return { jwtService, configService, redisService };
  }

  it('gan req.user va goi next() khi token hop le va tai khoan khong bi blacklist', async () => {
    const { jwtService, configService, redisService } = createDeps();
    const middleware = createJwtAuthMiddleware(jwtService, configService, redisService);
    const req = createReq();
    const res = createRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect((req as unknown as { user?: JwtAccessPayload }).user).toEqual(PAYLOAD);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('tra ve 401 khi thieu token', async () => {
    const { jwtService, configService, redisService } = createDeps();
    const middleware = createJwtAuthMiddleware(jwtService, configService, redisService);
    const req = createReq({ headers: {} });
    const res = createRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('tra ve 401 khi token khong hop le/het han', async () => {
    const { jwtService, configService, redisService } = createDeps({ verifyError: true });
    const middleware = createJwtAuthMiddleware(jwtService, configService, redisService);
    const req = createReq();
    const res = createRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('tra ve 401 khi tai khoan da bi blacklist', async () => {
    const { jwtService, configService, redisService } = createDeps({ blacklisted: true });
    const middleware = createJwtAuthMiddleware(jwtService, configService, redisService);
    const req = createReq();
    const res = createRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('fail-open (van goi next) khi Redis loi luc kiem tra blacklist', async () => {
    const { jwtService, configService, redisService } = createDeps({
      blacklisted: new Error('Redis timeout'),
    });
    const middleware = createJwtAuthMiddleware(jwtService, configService, redisService);
    const req = createReq();
    const res = createRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('KHONG tao unhandled promise rejection khi next() nem loi DONG BO sau khi xac thuc thanh cong, ma tra ve 500 qua duong dan loi chuan', async () => {
    const { jwtService, configService, redisService } = createDeps();
    const middleware = createJwtAuthMiddleware(jwtService, configService, redisService);
    const req = createReq();
    const res = createRes();
    const next = jest.fn(() => {
      throw new Error('loi dong bo tu middleware/proxy phia sau (mo phong)');
    });

    const unhandledRejectionSpy = jest.fn();
    process.on('unhandledRejection', unhandledRejectionSpy);

    try {
      await middleware(req, res, next);
      // Cho vong lap su kien them 1 tick de "unhandledRejection" (neu co) kip phat sinh truoc
      // khi kiem tra - day chinh la dieu kien tai hien bug goc (promise "roi" khoi try/catch).
      await new Promise((resolve) => setImmediate(resolve));

      expect(unhandledRejectionSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandledRejectionSpy);
    }
  });
});
