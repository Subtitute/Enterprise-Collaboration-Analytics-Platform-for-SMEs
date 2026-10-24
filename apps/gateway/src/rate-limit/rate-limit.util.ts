import type { Request } from 'express';

/**
 * Logic thuan (khong phu thuoc Redis/Express) cho bo dem rate-limit fixed-window
 * (INCR + EXPIRE lan dau) - Technical_Spec.md muc 8. Tach rieng de unit test de dang.
 */

// 25/07/2026: uu tien X-Real-IP truoc X-Forwarded-For - phat hien qua code review toan du an:
// X-Forwarded-For hoan toan do CLIENT tu dat gia tri dau tien (nginx phia truoc chi APPEND them
// $remote_addr thuc su vao SAU gia tri client da gui, xem $proxy_add_x_forwarded_for trong
// apps/web/nginx.conf), nen ke tan cong co the gui san "X-Forwarded-For: 1.2.3.4" gia mao de
// getClientIp() lay nham dia chi gia -> vo hieu hoa toan bo rate-limit theo IP, ke ca chan
// brute-force dang nhap. Nguoc lai X-Real-IP duoc apps/web/nginx.conf GAN DE (khong phai append)
// bang $remote_addr - dia chi socket peer thuc su nginx thay, client KHONG THE ghi de duoc du co
// tu gui header nay len. Van giu X-Forwarded-For va socket.remoteAddress lam fallback (theo dung
// thu tu cu) vi trong dev cuc bo/unit test co the khong co reverse proxy nao dung truoc Gateway.
/** Lay dia chi IP cua client, uu tien X-Real-IP (khong the client gia mao khi co Nginx phia truoc). */
export function getClientIp(req: Pick<Request, 'headers' | 'socket'>): string {
  const realIp = req.headers['x-real-ip'];
  const realIpValue = Array.isArray(realIp) ? realIp[0] : realIp;
  if (realIpValue) {
    return realIpValue.trim();
  }

  const forwarded = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (forwardedValue) {
    return forwardedValue.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

/** Danh tinh nguoi goi da xac thuc (tu JWT) dung de xay khoa rate-limit theo nguoi dung. */
export interface RateLimitIdentity {
  organizationId: string;
  userId: string;
}

/**
 * Xay khoa Redis cho bo dem rate-limit - Technical_Spec.md muc 8.
 *
 * 24/10/2026: request DA xac thuc nay dem theo NGUOI DUNG (organizationId + userId), khong con theo
 * (organizationId + IP) nhu truoc. Phat hien qua ra soat cuoi (Playwright: 3 nguoi dung demo duyet
 * 26 trang, nghi 2,5 giay giua cac trang -> 50 lan 429, ma tran /admin/roles khong hien duoc > 20
 * giay): 1 van phong that thuong di ra Internet qua CUNG 1 IP (NAT), nen ca to chuc dung chung 1 bo
 * dem 100 request/phut trong khi 1 trang SPA da ban 8-15 request. Cung ly do do, moi lenh goi tool
 * cua Chat bot (di tu IP container analytics-service, Technical_Spec.md muc 23) truoc day dung chung
 * 1 bo dem cho ca to chuc - nay moi lenh mang JWT cua chinh nguoi hoi nen tu dong dem dung nguoi.
 * Request chua xac thuc (dang nhap, quen mat khau...) VAN dem theo IP - lop chan brute-force giu nguyen.
 */
export function buildRateLimitKey(ip: string, identity?: RateLimitIdentity): string {
  return identity ? `ratelimit:user:${identity.organizationId}:${identity.userId}` : `ratelimit:ip:${ip}`;
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
