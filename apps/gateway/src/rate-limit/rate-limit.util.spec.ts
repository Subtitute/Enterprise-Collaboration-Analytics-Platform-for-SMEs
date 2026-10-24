import { buildRateLimitKey, evaluateRateLimit, getClientIp } from './rate-limit.util';

/**
 * Unit test cho logic thuan cua bo dem rate-limit - Technical_Spec.md muc 8.
 */
describe('buildRateLimitKey', () => {
  it('chi dung IP khi chua biet organizationId', () => {
    expect(buildRateLimitKey('1.2.3.4')).toBe('ratelimit:ip:1.2.3.4');
  });

  // 24/10/2026: da xac thuc -> dem theo NGUOI DUNG, khong phu thuoc IP (ca van phong chung 1 IP NAT).
  it('dem theo nguoi dung khi da xac thuc, khong phu thuoc IP', () => {
    const identity = { organizationId: 'org-1', userId: 'user-1' };
    expect(buildRateLimitKey('1.2.3.4', identity)).toBe('ratelimit:user:org-1:user-1');
    expect(buildRateLimitKey('5.6.7.8', identity)).toBe(buildRateLimitKey('1.2.3.4', identity));
  });

  it('2 nguoi dung cung 1 IP co 2 bo dem rieng', () => {
    expect(buildRateLimitKey('1.2.3.4', { organizationId: 'org-1', userId: 'user-1' })).not.toBe(
      buildRateLimitKey('1.2.3.4', { organizationId: 'org-1', userId: 'user-2' }),
    );
  });
});

describe('evaluateRateLimit', () => {
  it('cho phep khi so dem con duoi nguong', () => {
    const decision = evaluateRateLimit(5, 100);
    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(95);
  });

  it('cho phep khi so dem bang dung nguong', () => {
    const decision = evaluateRateLimit(100, 100);
    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(0);
  });

  it('tu choi khi so dem vuot nguong', () => {
    const decision = evaluateRateLimit(101, 100);
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
  });
});

// 25/07/2026: bo sung nhom test cho fix chong gia mao X-Forwarded-For (xem getClientIp trong
// rate-limit.util.ts) - phat hien qua code review toan du an: truoc day getClientIp() lay
// PHAN TU DAU cua X-Forwarded-For, header nay hoan toan do client tu dat (nginx chi APPEND vao
// sau, khong ghi de - xem $proxy_add_x_forwarded_for trong apps/web/nginx.conf), nen mot client
// gui san "X-Forwarded-For: <ip gia>" se lam rate-limit theo IP (ke ca chan brute-force dang
// nhap) tinh nham theo dia chi gia do, vo hieu hoa hoan toan co che bao ve. X-Real-IP thi nguoc
// lai duoc nginx GAN DE bang $remote_addr (dia chi socket peer thuc su) nen client khong the
// gia mao du co tu gui header nay len.
describe('getClientIp', () => {
  it('uu tien X-Real-IP ke ca khi X-Forwarded-For bi gia mao (nginx GHI DE X-Real-IP, client khong the gia mao)', () => {
    const req = {
      headers: {
        'x-real-ip': '203.0.113.9',
        'x-forwarded-for': '6.6.6.6', // gia tri gia mao ke tan cong tu gui len
      },
      socket: { remoteAddress: '127.0.0.1' },
    };
    expect(getClientIp(req as any)).toBe('203.0.113.9');
  });

  it('fallback ve X-Forwarded-For (phan tu dau) khi khong co X-Real-IP (vd dev cuc bo/khong qua nginx)', () => {
    const req = {
      headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    expect(getClientIp(req as any)).toBe('9.9.9.9');
  });

  it('fallback cuoi cung ve socket.remoteAddress khi khong co ca X-Real-IP lan X-Forwarded-For', () => {
    const req = { headers: {}, socket: { remoteAddress: '10.0.0.5' } };
    expect(getClientIp(req as any)).toBe('10.0.0.5');
  });

  it('tra ve "unknown" khi khong xac dinh duoc IP', () => {
    const req = { headers: {}, socket: {} };
    expect(getClientIp(req as any)).toBe('unknown');
  });
});
