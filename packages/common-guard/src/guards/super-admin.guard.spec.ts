import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@app/common-dto';
import { SuperAdminGuard } from './super-admin.guard';

/**
 * 16/09/2026: unit test cho SuperAdminGuard - "Super Admin" (tinh nang moi). Mirror cau truc
 * internal-auth.guard.spec.ts (context/reflector gia lap thu cong, khong boot NestJS module that).
 */
function createContext(user?: { isSuperAdmin?: boolean }): ExecutionContext {
  const req = { user };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function reflectorReturning(required: boolean | undefined): Reflector {
  return { getAllAndOverride: jest.fn().mockReturnValue(required) } as unknown as Reflector;
}

describe('SuperAdminGuard', () => {
  it('cho phep di qua ngay (khong kiem tra user) khi route khong danh dau @RequireSuperAdmin()', () => {
    const guard = new SuperAdminGuard(reflectorReturning(undefined));
    const ctx = createContext(undefined);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('cho phep di qua khi route yeu cau Super Admin VA user.isSuperAdmin = true', () => {
    const guard = new SuperAdminGuard(reflectorReturning(true));
    const ctx = createContext({ isSuperAdmin: true });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('tu choi (ForbiddenException/FORBIDDEN_SUPER_ADMIN_ONLY) khi user.isSuperAdmin = false', () => {
    const guard = new SuperAdminGuard(reflectorReturning(true));
    const ctx = createContext({ isSuperAdmin: false });

    let caught: ForbiddenException | undefined;
    try {
      guard.canActivate(ctx);
    } catch (err) {
      caught = err as ForbiddenException;
    }
    expect(caught).toBeInstanceOf(ForbiddenException);
    expect((caught?.getResponse() as { errorCode: string }).errorCode).toBe(ERROR_CODES.FORBIDDEN_SUPER_ADMIN_ONLY);
  });

  it('tu choi khi khong co req.user (chua qua InternalAuthGuard)', () => {
    const guard = new SuperAdminGuard(reflectorReturning(true));
    const ctx = createContext(undefined);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
