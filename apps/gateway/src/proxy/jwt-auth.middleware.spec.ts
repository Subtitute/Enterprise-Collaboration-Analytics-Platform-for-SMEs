import { extractBearerToken, isPublicRoute } from './jwt-auth.middleware';

/**
 * Unit test cho logic thuan cua middleware xac thuc JWT tren Gateway - Technical_Spec.md muc 6.
 */
describe('isPublicRoute', () => {
  it.each([
    '/api/v1/auth/register-organization',
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/health',
  ])('coi %s la route cong khai', (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  it('khop CHINH XAC, khong khop tien to', () => {
    expect(isPublicRoute('/api/v1/auth/login/extra')).toBe(false);
  });

  it('coi cac route con lai la can xac thuc', () => {
    expect(isPublicRoute('/api/v1/users')).toBe(false);
    expect(isPublicRoute('/api/v1/auth/logout')).toBe(false);
  });
});

describe('extractBearerToken', () => {
  it('tra ve token khi header dung dinh dang "Bearer <token>"', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('khong phan biet hoa/thuong tu khoa "bearer"', () => {
    expect(extractBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('tra ve null khi thieu header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('tra ve null khi sai scheme', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
  });

  it('tra ve null khi khong co token sau scheme', () => {
    expect(extractBearerToken('Bearer')).toBeNull();
  });
});
