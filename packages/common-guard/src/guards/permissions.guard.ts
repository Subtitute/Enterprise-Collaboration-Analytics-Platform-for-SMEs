import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthContext, Permission } from '@app/common-dto';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/** Kiem tra req.user.permissions (gan boi InternalAuthGuard) co du permission yeu cau. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user: AuthContext | undefined = req.user;
    if (!user) {
      throw new ForbiddenException('Khong xac dinh duoc nguoi dung');
    }

    const hasAll = required.every((perm) => user.permissions.includes(perm));
    if (!hasAll) {
      throw new ForbiddenException(`Ban khong co quyen thuc hien hanh dong nay (${required.join(', ')})`);
    }
    return true;
  }
}
