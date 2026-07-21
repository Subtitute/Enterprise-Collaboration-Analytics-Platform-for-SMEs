import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InternalAuthGuard, INTERNAL_SHARED_SECRET_HEADER } from './internal-auth.guard';

/**
 * Unit test cho InternalAuthGuard - Technical_Spec.md muc 6 (bo sung 21/07/2026):
 * moi service phia sau Gateway phai kiem tra header `x-internal-secret` khop voi
 * INTERNAL_SHARED_SECRET truoc khi tin cac header context (x-org-id/x-user-id/...).
 */
function createContext(headers: Record<string, string>): ExecutionContext {
  const req = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function reflectorReturning(isPublic: boolean | undefined): Reflector {
  return { getAllAndOverride: jest.fn().mockReturnValue(isPublic) } as unknown as Reflector;
}

describe('InternalAuthGuard', () => {
  const ORIGINAL_SECRET = process.env.INTERNAL_SHARED_SECRET;

  beforeEach(() => {
    process.env.INTERNAL_SHARED_SECRET = 'test-shared-secret';
  });

  afterEach(() => {
    process.env.INTERNAL_SHARED_SECRET = ORIGINAL_SECRET;
  });

  it('cho phep di qua khi secret dung va co du header context noi bo', () => {
    const guard = new InternalAuthGuard(reflectorReturning(false));
    const ctx = createContext({
      [INTERNAL_SHARED_SECRET_HEADER]: 'test-shared-secret',
      'x-user-id': 'user-1',
      'x-org-id': 'org-1',
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('tu choi (UnauthorizedException) khi thieu header secret', () => {
    const guard = new InternalAuthGuard(reflectorReturning(false));
    const ctx = createContext({
      'x-user-id': 'user-1',
      'x-org-id': 'org-1',
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('tu choi (UnauthorizedException) khi secret sai', () => {
    const guard = new InternalAuthGuard(reflectorReturning(false));
    const ctx = createContext({
      [INTERNAL_SHARED_SECRET_HEADER]: 'wrong-secret',
      'x-user-id': 'user-1',
      'x-org-id': 'org-1',
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('tu choi khi secret dung nhung thieu header context (x-org-id/x-user-id)', () => {
    const guard = new InternalAuthGuard(reflectorReturning(false));
    const ctx = createContext({
      [INTERNAL_SHARED_SECRET_HEADER]: 'test-shared-secret',
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('bo qua toan bo kiem tra (ke ca secret) doi voi route cong khai (@Public)', () => {
    const guard = new InternalAuthGuard(reflectorReturning(true));
    const ctx = createContext({});

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
