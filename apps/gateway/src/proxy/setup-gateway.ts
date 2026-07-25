import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'http';
import type { Duplex } from 'stream';
import { RedisService } from '../redis/redis.service';
import { createRateLimitMiddleware } from '../rate-limit/rate-limit.middleware';
import { createJwtAuthMiddleware } from './jwt-auth.middleware';
import { createServiceProxy } from './rest-proxy.factory';
import { createWsServiceProxy } from './ws-proxy.factory';
import { matchesPrefix } from './path-match.util';
import { REST_PROXY_ROUTES, WS_PROXY_ROUTES } from './proxy-routes.config';

const logger = new Logger('Gateway');

/** http-proxy-middleware v3 gan them .upgrade() tren middleware khi ws: true. */
interface UpgradeCapableProxy {
  upgrade: (req: unknown, socket: Duplex, head: Buffer) => void;
}

/**
 * Lap rap toan bo pipeline cua Gateway (Technical_Spec.md muc 6, muc 8), theo dung THU TU:
 *   1) xac thuc JWT + gan req.user (bo qua route cong khai va duong dan /ws/*)
 *   2) rate-limit theo IP (+ organizationId khi da biet, tu req.user vua duoc gan o buoc 1)
 *   3) proxy REST toi tung downstream service, gan header noi bo tu req.user (x-org-id, x-user-id, ...)
 *   4) proxy WebSocket (Socket.IO) - KHONG gan header, downstream tu verify token tu handshake
 *
 * Xac thuc JWT PHAI chay TRUOC rate-limit (dieu chinh 21/07/2026 - truoc do thu tu nguoc lam
 * req.user luon undefined luc rate-limit doc, nen khoa rate-limit tren thuc te chi bao gio la
 * IP-only, phan organizationId khong bao gio kich hoat). Voi route cong khai (vd /auth/login),
 * middleware xac thuc JWT bo qua HOAN TOAN (khong gan req.user) - Boi vay rate-limit cho cac
 * route nay van chi la IP-only, DUNG NHU THIET KE: truoc khi dang nhap thanh cong thi chua co
 * organizationId de gan vao khoa, day la gioi han von co (khong phai loi) - van du de chan
 * brute-force theo IP.
 *
 * Tat ca middleware/proxy duoc app.use() TAI GOC (khong gan theo path) de tranh Express
 * cat bo doan prefix khoi req.url - gateway phai path-preserving vi downstream dung chung
 * tien to /api/v1/... voi client.
 *
 * Ham tra ve dung de noi su kien 'upgrade' cua http.Server (chi co duoc SAU app.listen()) toi
 * dung proxy WebSocket theo tien to duong dan, vi Express khong tu xu ly duoc upgrade request.
 */
export function setupGateway(app: INestApplication): (server: Server) => void {
  const configService = app.get(ConfigService);
  const jwtService = app.get(JwtService);
  const redisService = app.get(RedisService);

  app.use(createJwtAuthMiddleware(jwtService, configService, redisService));
  app.use(createRateLimitMiddleware(redisService, configService));

  for (const group of REST_PROXY_ROUTES) {
    const target = configService.get<string>(group.targetConfigKey);
    app.use(createServiceProxy(group.prefixes, target as string));
  }

  const wsProxies = WS_PROXY_ROUTES.map((route) => {
    const target = configService.get<string>(route.targetConfigKey);
    const proxy = createWsServiceProxy(route.prefix, target as string, route.pathRewrite);
    app.use(proxy);
    return { prefix: route.prefix, proxy: proxy as unknown as UpgradeCapableProxy };
  });

  return (server: Server) => {
    // 25/07/2026: ghi chu ro rang (phat hien qua code review toan du an) - KHAC voi viec bo qua
    // xac thuc JWT cho /ws/* (co chu dich, da giai thich o dau file), handler 'upgrade' nay hoan
    // toan KHONG di qua createRateLimitMiddleware() (chi app.use() duoc - middleware Express
    // thuong khong bao gio chay tren su kien 'upgrade' cua http.Server, vi Express router chi xu
    // ly request/response HTTP thong thuong). Nghia la traffic nang cap WebSocket
    // (/ws/notifications, /ws/analytics) hien KHONG bi rate-limit o tang Gateway. Day la GIOI HAN
    // DA BIET va CHAP NHAN duoc trong pham vi lan sua nay (khong trien khai rate-limit cho WS
    // upgrade o day) - KHONG phai thieu sot vo tinh; can theo doi rieng neu sau nay can chan
    // spam ket noi WS.
    server.on('upgrade', (req, socket, head) => {
      const pathname = (req.url ?? '').split('?')[0];
      const match = wsProxies.find(({ prefix }) => matchesPrefix(pathname, [prefix]));

      if (!match) {
        logger.warn(`Tu choi WebSocket upgrade khong khop route nao: ${pathname}`);
        socket.destroy();
        return;
      }

      match.proxy.upgrade(req, socket, head);
    });
  };
}
