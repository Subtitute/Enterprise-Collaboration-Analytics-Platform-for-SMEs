import { buildRateLimitKey, evaluateRateLimit, getClientIp } from './rate-limit.util';

/**
 * Unit test cho logic thuan cua bo dem rate-limit - Technical_Spec.md muc 8.
 */
describe('buildRateLimitKey', () => {
  it('chi dung IP khi chua biet organizationId', () => {
    expect(buildRateLimitKey('1.2.3.4')).toBe('ratelimit:ip:1.2.3.4');
  });

  it('gom ca organizationId khi da biet (sau khi xac thuc)', () => {
    expect(buildRateLimitKey('1.2.3.4', 'org-1')).toBe('ratelimit:org:org-1:1.2.3.4');
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

describe('getClientIp', () => {
  it('uu tien X-Forwarded-For khi co (Gateway co the sau LB/reverse proxy khac)', () => {
    const req = {
      headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    expect(getClientIp(req as any)).toBe('9.9.9.9');
  });

  it('dung socket.remoteAddress khi khong co X-Forwarded-For', () => {
    const req = { headers: {}, socket: { remoteAddress: '10.0.0.5' } };
    expect(getClientIp(req as any)).toBe('10.0.0.5');
  });

  it('tra ve "unknown" khi khong xac dinh duoc IP', () => {
    const req = { headers: {}, socket: {} };
    expect(getClientIp(req as any)).toBe('unknown');
  });
});
