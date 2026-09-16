import { SetMetadata } from '@nestjs/common';

/**
 * 16/09/2026: danh dau endpoint CHI danh cho Super Admin (quan tri nen tang, khong thuoc 1 to
 * chuc nghiep vu nao - xem AuthContext.isSuperAdmin, @app/common-dto). Dung voi SuperAdminGuard,
 * mirror dung mau RequirePermissions()/PermissionsGuard da co san nhung tach guard rieng vi day
 * la 1 cap do quyen han khac han RBAC theo to chuc (Super Admin khong co permissions[] nao ca).
 */
export const IS_SUPER_ADMIN_ONLY_KEY = 'isSuperAdminOnly';
export const RequireSuperAdmin = () => SetMetadata(IS_SUPER_ADMIN_ONLY_KEY, true);
