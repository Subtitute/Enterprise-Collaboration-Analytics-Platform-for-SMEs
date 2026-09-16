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

function createProxyReq(): { proxyReq: ClientRequest; setHeader: jest.Mock } {
  const setHeader = jest.fn();
  return { proxyReq: { setHeader } as unknown as ClientRequest, setHeader };
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
