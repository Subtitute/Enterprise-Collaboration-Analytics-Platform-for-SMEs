import { HealthCheckError, type HealthIndicatorResult } from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';

/**
 * 22/08/2026: fix audit "GET /health chi la liveness-only" tren Gateway (Technical_Spec.md muc
 * 6, muc 8). @nestjs/terminus KHONG co san health indicator cho ioredis (chi co
 * TypeOrmHealthIndicator/MongooseHealthIndicator/... - xem @nestjs/terminus/dist/health-indicator)
 * nen phai tu viet ham kiem tra nay. Gateway khong co DB rieng (pure reverse-proxy, xem header
 * src/proxy/setup-gateway.ts) nhung PHU THUOC Redis cho ca 2 chuc nang: bo dem rate-limit
 * (INCR/EXPIRE - xem rate-limit.middleware.ts) va kiem tra JWT blacklist
 * (RedisService.isUserBlacklisted) - Redis "chet" nghia la ca 2 co che bao ve nay deu ngung
 * hoat dong dung, nen /health PHAI phan anh dieu do thay vi tra {status:'ok'} cung cung.
 *
 * Dung lai client ioredis co san tu RedisService (KHONG tao ket noi rieng cho health check) va
 * PING that su. Nem HealthCheckError (thay vi tra thang {status:'down'}) theo dung quy uoc cua
 * indicator function trong Terminus - HealthCheckService.check() bat loi nay va gop vao
 * key "error" cua ket qua cuoi cung, tu do anh xa sang HTTP 503.
 *
 * 22/08/2026 (kiem tra thuc te qua docker compose): `.ping()` KHONG tu that bai nhanh khi mat
 * ket noi - ioredis mac dinh `enableOfflineQueue: true` nen lenh bi XEP HANG CHO cho toi khi ket
 * noi lai duoc (hoac toi khi het `maxRetriesPerRequest`, mac dinh 20 lan retry voi backoff, co
 * the mat toi hang chuc giay) thay vi tra loi ngay. Da kiem chung: dung container Redis roi goi
 * GET /health thi request "treo" cho den khi Redis duoc khoi dong lai, KHONG tra 503 ngay - phan
 * lon truong hop se vuot qua "timeout: 5s" cua Docker healthcheck (infra/docker-compose.yml) nen
 * van bi danh dau unhealthy sau vai lan thu, nhung ban than response HTTP se "treo" thay vi tra
 * ve 503 xac dinh cho bat ky ai/thu gi khac goi truc tiep /health (vd load balancer, script kiem
 * tra thu cong). Boc them Promise.race voi timeout rieng de dam bao check nay LUON tra loi (up
 * hoac down) trong khoang thoi gian gioi han, khong phu thuoc vao hanh vi hang doi cua ioredis.
 */
const DEFAULT_TIMEOUT_MS = 2000;

export async function checkRedis(
  redisService: RedisService,
  key: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<HealthIndicatorResult> {
  // 'unref' de timer nay KHONG giu tien trinh Node song them (khong lien quan gi den viec HTTP
  // server co dang lang nghe hay khong) - chi don gian tranh "leak" mot timer treo toi 2s moi
  // lan health check chay (Docker goi lai moi 10s - xem infra/docker-compose.yml).
  let timer: NodeJS.Timeout | undefined;
  try {
    const reply = await Promise.race([
      redisService.getClient().ping(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`PING Redis khong phan hoi sau ${timeoutMs}ms`)), timeoutMs);
        timer.unref();
      }),
    ]);
    if (reply !== 'PONG') {
      throw new Error(`PING Redis tra ve gia tri khong mong doi: ${reply}`);
    }
    return { [key]: { status: 'up' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new HealthCheckError('Redis check failed', {
      [key]: { status: 'down', message },
    });
  } finally {
    clearTimeout(timer);
  }
}
