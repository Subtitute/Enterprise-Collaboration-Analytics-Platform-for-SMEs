import type { Request } from 'express';

/**
 * Logic thuan (khong phu thuoc Redis/Express) cho bo dem rate-limit fixed-window
 * (INCR + EXPIRE lan dau) - Technical_Spec.md muc 8. Tach rieng de unit test de dang.
 */

/** Lay dia chi IP cua client, uu tien X-Forwarded-For (Gateway thuong sau reverse proxy/LB). */
export function getClientIp(req: Pick<Request, 'headers' | 'socket'>): string {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (forwardedValue) {
    return forwardedValue.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

/**
 * Xay khoa Redis cho bo dem rate-limit: theo IP, va them organizationId khi da biet
 * (vd: request da qua duoc buoc xac thuc JWT truoc do) - Technical_Spec.md muc 8.
 */
export function buildRateLimitKey(ip: string, organizationId?: string): string {
  return organizationId ? `ratelimit:org:${organizationId}:${ip}` : `ratelimit:ip:${ip}`;
}

export interface RateLimitDecision {
  allowed: boolean;
  count: number;
  remaining: number;
}

/** Quyet dinh cho phep/tu choi dua tren so dem hien tai (sau khi da INCR) va nguong toi da. */
export function evaluateRateLimit(count: number, max: number): RateLimitDecision {
  return {
    allowed: count <= max,
    count,
    remaining: Math.max(0, max - count),
  };
}
