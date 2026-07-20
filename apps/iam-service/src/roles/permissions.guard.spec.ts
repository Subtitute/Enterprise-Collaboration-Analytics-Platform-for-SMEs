import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';

/**
 * Unit test toi thieu cho RBAC guard - Technical_Spec.md muc 10
 * ("Unit test: ... RBAC guard cua IAM").
 */
function createContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard (RBAC)', () => {
  it('cho phep di qua khi handler khong yeu cau permission nao', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(createContext({ permissions: [] }))).toBe(true);
  });

  it('cho phep khi user co du permission yeu cau', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PERMISSIONS.TASK_CREATE]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const ctx = createContext({ permissions: [PERMISSIONS.TASK_CREATE, PERMISSIONS.TASK_VIEW] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('tu choi (ForbiddenException) khi user thieu permission yeu cau', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PERMISSIONS.USER_MANAGE]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const ctx = createContext({ permissions: [PERMISSIONS.TASK_VIEW] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('tu choi khi khong xac dinh duoc nguoi dung (req.user rong)', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PERMISSIONS.USER_MANAGE]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(createContext(undefined))).toThrow(ForbiddenException);
  });
});
