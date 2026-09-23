import { PERMISSIONS_KEY } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { RolesController } from './roles.controller';

/**
 * 22/07/2026: unit test toi thieu cho RBAC cua RolesController - review phat hien GET /roles va
 * GET /roles/permissions truoc do KHONG co bat ky guard nao (moi nhan vien da xac thuc, ke ca
 * role Employee, deu doc duoc toan bo danh sach vai tro/quyen han cua ca to chuc) ma KHONG co
 * test nao bao ve dieu do (loi MAJOR, review 22/07/2026). Kiem tra THANG metadata
 * @RequirePermissions da duoc gan tren tung handler (khac voi
 * apps/iam-service/src/roles/permissions.guard.spec.ts da co san, chi test PermissionsGuard voi
 * Reflector gia lap chu khong gan voi controller/handler thuc te nao).
 */
describe('RolesController - RBAC (Fix 5, review 22/07/2026)', () => {
  it('GET /roles (findAll) yeu cau permission role:manage', () => {
    const required = Reflect.getMetadata(PERMISSIONS_KEY, RolesController.prototype.findAll);
    expect(required).toEqual([PERMISSIONS.ROLE_MANAGE]);
  });

  it('GET /roles/permissions (findAllPermissions) yeu cau permission role:manage', () => {
    const required = Reflect.getMetadata(PERMISSIONS_KEY, RolesController.prototype.findAllPermissions);
    expect(required).toEqual([PERMISSIONS.ROLE_MANAGE]);
  });

  // 22/09/2026: RBAC audit log - endpoint moi phai co CUNG ranh gioi quyen voi cac endpoint quan
  // tri khac cua controller nay.
  it('GET /roles/audit-log (findPermissionChangeLog) yeu cau permission role:manage', () => {
    const required = Reflect.getMetadata(PERMISSIONS_KEY, RolesController.prototype.findPermissionChangeLog);
    expect(required).toEqual([PERMISSIONS.ROLE_MANAGE]);
  });
});
