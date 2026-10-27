import { DEFAULT_ROLE_PERMISSIONS, DefaultRoleName, PERMISSIONS } from '../enums/permission.enum';
import { normalizeVietnamesePhone, resolveDataScope, resolveRoleLevel } from './data-scope';

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

/** 26/10/2026: muc vai tro + chuan hoa so dien thoai (Technical_Spec.md muc 27.4/27.10). */
describe('resolveRoleLevel', () => {
  it('lay muc cao nhat, khong phan biet hoa thuong, rong -> EMPLOYEE', () => {
    expect(resolveRoleLevel(['Employee', 'Manager'])).toBe('MANAGER');
    expect(resolveRoleLevel(['manager', 'Org Admin'])).toBe('ORG_ADMIN');
    expect(resolveRoleLevel(['Employee'])).toBe('EMPLOYEE');
    expect(resolveRoleLevel([])).toBe('EMPLOYEE');
    expect(resolveRoleLevel(undefined)).toBe('EMPLOYEE');
  });
});

describe('normalizeVietnamesePhone', () => {
  it('chuan hoa di dong/co dinh, +84 -> 0', () => {
    expect(normalizeVietnamesePhone('0912 345 678')).toBe('0912345678');
    expect(normalizeVietnamesePhone('+84 912.345.678')).toBe('0912345678');
    expect(normalizeVietnamesePhone('84912345678')).toBe('0912345678');
    expect(normalizeVietnamesePhone('0283 812 3456')).toBe('02838123456');
    expect(normalizeVietnamesePhone('(028) 3812-3456')).toBe('02838123456');
  });

  it('tu choi dau so sai/thieu/thua chu so', () => {
    expect(normalizeVietnamesePhone('0112345678')).toBeNull();
    expect(normalizeVietnamesePhone('091234567')).toBeNull();
    expect(normalizeVietnamesePhone('09123456789')).toBeNull();
    expect(normalizeVietnamesePhone('abc')).toBeNull();
  });
});
