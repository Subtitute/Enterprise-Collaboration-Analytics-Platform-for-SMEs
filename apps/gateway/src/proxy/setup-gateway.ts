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
 *   1) rate-limit theo IP (+ organizationId khi da biet) - som nhat, chan ca brute-force dang nhap
 *   2) xac thuc JWT + gan req.user (bo qua route cong khai va duong dan /ws/*)
 *   3) proxy REST toi tung downstream service, gan header noi bo tu req.user (x-org-id, x-user-id, ...)
 *   4) proxy WebSocket (Socket.IO) - KHONG gan header, downstream tu verify token tu handshake
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

  app.use(createRateLimitMiddleware(redisService, configService));
  app.use(createJwtAuthMiddleware(jwtService, configService));

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
