import { DEFAULT_ROLE_PERMISSIONS, DefaultRoleName, PERMISSIONS } from '../enums/permission.enum';
import { resolveDataScope } from './data-scope';

/** 26/10/2026: pham vi du lieu 3 cap - xem chu thich tai data-scope.ts. */
describe('resolveDataScope', () => {
  const dept = 'dept-1';

  it('Org Admin (co USER_MANAGE) luon la toan to chuc, ke ca khi khong thuoc phong ban nao', () => {
    expect(resolveDataScope(DEFAULT_ROLE_PERMISSIONS[DefaultRoleName.ORG_ADMIN], PERMISSIONS.PROJECT_CREATE, null)).toBe('organization');
  });

  it('Manager co quyen cap Manager cua module + co phong ban -> pham vi phong ban', () => {
    expect(resolveDataScope(DEFAULT_ROLE_PERMISSIONS[DefaultRoleName.MANAGER], PERMISSIONS.PROJECT_CREATE, dept)).toBe('department');
  });

  it('Manager chua duoc gan phong ban -> chi du lieu cua chinh minh', () => {
    expect(resolveDataScope(DEFAULT_ROLE_PERMISSIONS[DefaultRoleName.MANAGER], PERMISSIONS.PROJECT_CREATE, null)).toBe('self');
  });

  it('Employee (khong co quyen cap Manager cua module) -> chi du lieu cua chinh minh du co phong ban', () => {
    expect(resolveDataScope(DEFAULT_ROLE_PERMISSIONS[DefaultRoleName.EMPLOYEE], PERMISSIONS.PROJECT_CREATE, dept)).toBe('self');
  });

  it('danh sach quyen null/undefined duoc coi la rong', () => {
    expect(resolveDataScope(undefined, PERMISSIONS.PROJECT_CREATE, dept)).toBe('self');
    expect(resolveDataScope(null, PERMISSIONS.PROJECT_CREATE, dept)).toBe('self');
  });
});
