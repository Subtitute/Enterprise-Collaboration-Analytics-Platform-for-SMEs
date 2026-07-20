import { SetMetadata } from '@nestjs/common';
import { Permission } from '@app/common-dto';

/** Khai bao permission bat buoc tren controller/handler - dung voi PermissionsGuard. */
export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
