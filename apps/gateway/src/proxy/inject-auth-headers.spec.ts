// 25/07/2026: file test moi - phat hien qua code review toan du an: resolveInternalSharedSecret()
// (logic fail-closed o production / fail-open kem canh bao ngoai production, phai dong bo hanh
// vi voi packages/common-guard/src/guards/internal-auth.guard.ts) truoc day CHUA co test nao
// trong apps/gateway. Mirror cau truc test cua internal-auth.guard.spec.ts (nhom "fail-open fix
// cho INTERNAL_SHARED_SECRET").
//
// resolveInternalSharedSecret() KHONG duoc export va gia tri cua no duoc giai quyet 1 LAN duy
// nhat luc module duoc import (RESOLVED_INTERNAL_SHARED_SECRET = resolveInternalSharedSecret()),
// nen moi test phai dat process.env TRUOC, roi dung jest.isolateModules() + require() de import
// lai module trong 1 registry rieng (tranh cache module lam cac test anh huong lan nhau). Logger
// cua @nestjs/common CUNG phai duoc require() lai BEN TRONG cung 1 sandbox do (thay vi dung
// import tinh o dau file) va spy TRUOC khi require './inject-auth-headers' - vi jest.isolateModules
// nap mot ban sao MOI, TACH BIET cua moi module (ke ca @nestjs/common) cho sandbox do, nen
// Logger.prototype duoc import tinh o dau file la MOT class KHAC (khong lien quan) voi
// Logger.prototype ma module vua duoc require lai thuc su dung ben trong.
import type { ClientRequest, IncomingMessage } from 'http';
import {
  DEV_FALLBACK_INTERNAL_SHARED_SECRET,
  INTERNAL_AUTH_HEADERS,
  INTERNAL_SHARED_SECRET_HEADER,
  type JwtAccessPayload,
} from '@app/common-dto';
import type { injectAuthHeaders as InjectAuthHeadersFn } from './inject-auth-headers';

type InjectAuthHeadersModule = { injectAuthHeaders: typeof InjectAuthHeadersFn };

/**
 * Require lai './inject-auth-headers' trong 1 sandbox module rieng (de RESOLVED_INTERNAL_SHARED_SECRET
 * duoc tinh lai tu process.env hien tai), dong thoi spy san Logger.prototype.warn CUA CHINH
 * sandbox do TRUOC khi require - xem giai thich o dau file ve ly do phai lam vay thay vi spy tren
 * Logger import tinh o ngoai.
 */
function requireFreshModule(): { mod: InjectAuthHeadersModule; warnSpy: jest.Mock } {
  let mod!: InjectAuthHeadersModule;
  let warnSpy!: jest.Mock;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nestCommon = require('@nestjs/common');
    warnSpy = jest.fn();
    nestCommon.Logger.prototype.warn = warnSpy;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('./inject-auth-headers');
  });
  return { mod, warnSpy };
}

// 26/10/2026: proxyReq gia giu header that (Map) - can cho test xoa header gia mao tu client.
function createProxyReq(initial: Record<string, string> = {}): {
  proxyReq: ClientRequest;
  setHeader: jest.Mock;
  headers: Map<string, string>;
} {
  const headers = new Map(Object.entries(initial).map(([k, v]) => [k.toLowerCase(), v]));
  const setHeader = jest.fn((name: string, value: string) => headers.set(name.toLowerCase(), value));
  const proxyReq = {
    setHeader,
    getHeaderNames: () => [...headers.keys()],
    removeHeader: (name: string) => headers.delete(name.toLowerCase()),
  } as unknown as ClientRequest;
  return { proxyReq, setHeader, headers };
}

describe('inject-auth-headers - resolveInternalSharedSecret (giai quyet luc module-load)', () => {
  const ORIGINAL_SECRET = process.env.INTERNAL_SHARED_SECRET;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.INTERNAL_SHARED_SECRET = ORIGINAL_SECRET;
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('nem loi NGAY luc import module khi NODE_ENV=production ma thieu INTERNAL_SHARED_SECRET', () => {
    delete process.env.INTERNAL_SHARED_SECRET;
    process.env.NODE_ENV = 'production';

    expect(() => requireFreshModule()).toThrow(/INTERNAL_SHARED_SECRET/);
  });

  it('fallback ve DEV_FALLBACK_INTERNAL_SHARED_SECRET kem Logger.warn khi ngoai production thieu bien moi truong', () => {
    delete process.env.INTERNAL_SHARED_SECRET;
    process.env.NODE_ENV = 'development';

    const { mod, warnSpy } = requireFreshModule();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('INTERNAL_SHARED_SECRET'));

    const { proxyReq, setHeader } = createProxyReq();
    mod.injectAuthHeaders(proxyReq, {} as IncomingMessage);

    expect(setHeader).toHaveBeenCalledWith(
      INTERNAL_SHARED_SECRET_HEADER,
      DEV_FALLBACK_INTERNAL_SHARED_SECRET,
    );
  });

  it('dung dung gia tri that tu bien moi truong khi da thiet lap (khong canh bao, khong fallback)', () => {
    process.env.INTERNAL_SHARED_SECRET = 'real-secret-tu-moi-truong';
    process.env.NODE_ENV = 'development';

    const { mod, warnSpy } = requireFreshModule();
    expect(warnSpy).not.toHaveBeenCalled();

    const { proxyReq, setHeader } = createProxyReq();
    mod.injectAuthHeaders(proxyReq, {} as IncomingMessage);

    expect(setHeader).toHaveBeenCalledWith(INTERNAL_SHARED_SECRET_HEADER, 'real-secret-tu-moi-truong');
  });
});

// 16/09/2026: bo sung test cho header x-is-super-admin ("Super Admin", tinh nang moi) - truoc day
// TOAN BO nhanh forward header tu req.user chua co test nao (chi test resolveInternalSharedSecret()
// o tren), them 1 test tap trung dung vao header MOI de xac nhan gia tri boolean duoc forward dung
// (khong bi bo qua/undefined) ca 2 chieu true/false.
describe('inject-auth-headers - forward x-is-super-admin tu req.user', () => {
  const ORIGINAL_SECRET = process.env.INTERNAL_SHARED_SECRET;

  afterEach(() => {
    process.env.INTERNAL_SHARED_SECRET = ORIGINAL_SECRET;
  });

  function buildUser(isSuperAdmin: boolean): JwtAccessPayload {
    return {
      sub: 'user-1',
      organizationId: 'org-1',
      email: 'user@example.com',
      roles: [],
      permissions: [],
      departmentId: null,
      isSuperAdmin,
    };
  }

  it('forward "true" khi user.isSuperAdmin = true', () => {
    process.env.INTERNAL_SHARED_SECRET = 'real-secret-tu-moi-truong';
    const { mod } = requireFreshModule();
    const { proxyReq, setHeader } = createProxyReq();

    mod.injectAuthHeaders(proxyReq, { user: buildUser(true) } as unknown as IncomingMessage);

    expect(setHeader).toHaveBeenCalledWith(INTERNAL_AUTH_HEADERS.IS_SUPER_ADMIN, 'true');
  });

  it('forward "false" khi user.isSuperAdmin = false (nguoi dung thuong)', () => {
    process.env.INTERNAL_SHARED_SECRET = 'real-secret-tu-moi-truong';
    const { mod } = requireFreshModule();
    const { proxyReq, setHeader } = createProxyReq();

    mod.injectAuthHeaders(proxyReq, { user: buildUser(false) } as unknown as IncomingMessage);

    expect(setHeader).toHaveBeenCalledWith(INTERNAL_AUTH_HEADERS.IS_SUPER_ADMIN, 'false');
  });
});

// 26/10/2026: lo hong gia mao header (Danh sach nhan vien & kho anh nhan dien) - Gateway PHAI xoa moi
// header tin cay client tu gui truoc khi dat lai tu JWT, ke ca khi JWT khong co gia tri cho header do.
describe('inject-auth-headers - xoa header noi bo gia mao tu client', () => {
  const ORIGINAL_SECRET = process.env.INTERNAL_SHARED_SECRET;
  afterEach(() => {
    process.env.INTERNAL_SHARED_SECRET = ORIGINAL_SECRET;
  });

  const spoofed = {
    [INTERNAL_AUTH_HEADERS.DEPARTMENT_ID]: 'dept-cua-nguoi-khac',
    [INTERNAL_AUTH_HEADERS.USER_ID]: 'user-gia',
    [INTERNAL_AUTH_HEADERS.ORG_ID]: 'org-gia',
    [INTERNAL_AUTH_HEADERS.EMAIL]: 'gia@x.vn',
    [INTERNAL_AUTH_HEADERS.ROLES]: 'Org Admin',
    [INTERNAL_AUTH_HEADERS.PERMISSIONS]: 'user:manage',
    [INTERNAL_AUTH_HEADERS.IS_SUPER_ADMIN]: 'true',
    [INTERNAL_SHARED_SECRET_HEADER]: 'secret-gia',
    'X-Internal-Anything': 'gia',
    'x-organization-id': 'org-gia',
    'x-user-department': 'gia',
  };

  function buildUser(departmentId: string | null): JwtAccessPayload {
    return {
      sub: 'user-that',
      organizationId: 'org-that',
      email: 'that@x.vn',
      roles: ['Manager'],
      permissions: ['user:invite'],
      departmentId,
      isSuperAdmin: false,
    };
  }

  it('JWT khong co phong ban: x-department-id cua client bi XOA (khong lot sang service)', () => {
    process.env.INTERNAL_SHARED_SECRET = 'real-secret';
    const { mod } = requireFreshModule();
    const { proxyReq, headers } = createProxyReq({ ...spoofed, 'content-type': 'application/json', authorization: 'Bearer t' });

    mod.injectAuthHeaders(proxyReq, { user: buildUser(null) } as unknown as IncomingMessage);

    expect(headers.has(INTERNAL_AUTH_HEADERS.DEPARTMENT_ID)).toBe(false);
    expect(headers.get(INTERNAL_AUTH_HEADERS.USER_ID)).toBe('user-that');
    expect(headers.get(INTERNAL_AUTH_HEADERS.ORG_ID)).toBe('org-that');
    expect(headers.get(INTERNAL_AUTH_HEADERS.PERMISSIONS)).toBe('user:invite');
    expect(headers.get(INTERNAL_AUTH_HEADERS.ROLES)).toBe('Manager');
    expect(headers.get(INTERNAL_AUTH_HEADERS.IS_SUPER_ADMIN)).toBe('false');
    expect(headers.get(INTERNAL_SHARED_SECRET_HEADER)).toBe('real-secret');
    expect(headers.has('x-internal-anything')).toBe(false);
    expect(headers.has('x-organization-id')).toBe(false);
    expect(headers.has('x-user-department')).toBe(false);
    // Header thuong cua client giu nguyen.
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('authorization')).toBe('Bearer t');
  });

  it('JWT co phong ban: gia tri tu JWT thay the gia tri gia mao', () => {
    process.env.INTERNAL_SHARED_SECRET = 'real-secret';
    const { mod } = requireFreshModule();
    const { proxyReq, headers } = createProxyReq(spoofed);

    mod.injectAuthHeaders(proxyReq, { user: buildUser('dept-that') } as unknown as IncomingMessage);

    expect(headers.get(INTERNAL_AUTH_HEADERS.DEPARTMENT_ID)).toBe('dept-that');
  });

  it('route cong khai (chua xac thuc): KHONG con header danh tinh nao cua client, chi bi mat that', () => {
    process.env.INTERNAL_SHARED_SECRET = 'real-secret';
    const { mod } = requireFreshModule();
    const { proxyReq, headers } = createProxyReq(spoofed);

    mod.injectAuthHeaders(proxyReq, {} as IncomingMessage);

    expect([...headers.keys()]).toEqual([INTERNAL_SHARED_SECRET_HEADER]);
    expect(headers.get(INTERNAL_SHARED_SECRET_HEADER)).toBe('real-secret');
  });

  it('isTrustedHeader nhan dien khong phan biet hoa thuong, bo qua header thuong', () => {
    process.env.INTERNAL_SHARED_SECRET = 'real-secret';
    const { mod } = requireFreshModule() as unknown as { mod: { isTrustedHeader: (n: string) => boolean } };
    expect(mod.isTrustedHeader('X-Department-Id')).toBe(true);
    expect(mod.isTrustedHeader('x-is-super-admin')).toBe(true);
    expect(mod.isTrustedHeader('x-correlation-id')).toBe(false);
    expect(mod.isTrustedHeader('x-real-ip')).toBe(false);
  });
});
