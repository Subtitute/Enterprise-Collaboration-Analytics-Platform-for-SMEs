import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthContext, ERROR_CODES } from '@app/common-dto';
import { IS_SUPER_ADMIN_ONLY_KEY } from '../decorators/super-admin.decorator';

/**
 * 16/09/2026: "Super Admin" (tinh nang moi) - kiem tra req.user.isSuperAdmin (gan boi
 * InternalAuthGuard tu header x-is-super-admin). Tach rieng khoi PermissionsGuard vi Super Admin
 * la 1 cap do quyen han khac han RBAC theo to chuc - no khong thuoc Role/Permission cua bat ky to
 * chuc nao (permissions[] luon rong), nen khong the dung @RequirePermissions(...) cho no duoc.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(IS_SUPER_ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const user: AuthContext | undefined = req.user;
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException({
        message: 'Chi Super Admin moi duoc thuc hien hanh dong nay',
        errorCode: ERROR_CODES.FORBIDDEN_SUPER_ADMIN_ONLY,
      });
    }
    return true;
  }
}
