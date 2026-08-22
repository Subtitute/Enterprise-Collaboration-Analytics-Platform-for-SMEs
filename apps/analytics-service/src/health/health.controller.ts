import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorResult, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '@app/common-guard';
import { RedisService } from '../redis/redis.service';

/**
 * 22/08/2026: fix audit "moi /health cua backend chi la liveness-only - {status:'ok'} co dinh
 * bat ke dependency that co song hay khong". Doi sang @nestjs/terminus:
 * - TypeOrmHealthIndicator.pingCheck('database'): SELECT 1 qua chinh DataSource TypeORM da khai
 *   bao trong app.module.ts (driver 'postgres' - TimescaleDB tuong thich Postgres wire protocol
 *   nen dung thang duoc, khong can driver rieng).
 * - Redis: @nestjs/terminus KHONG co san indicator cho ioredis, nen tu viet 1 ham nho goi
 *   RedisService.ping() (wrap PING that cua ioredis client, xem redis/redis.service.ts) va tu
 *   quy doi ket qua thanh HealthIndicatorResult ma HealthCheckService.check() cho phep truyen
 *   thang vao mang kiem tra (HealthIndicatorFunction = () => HealthIndicatorResult |
 *   PromiseLike<HealthIndicatorResult>) - khong can dang ky provider/module gi them.
 *
 * QUAN TRONG: giu nguyen route GET /health (khong doi ten/prefix) va @Public() - Docker healthcheck
 * (infra/docker-compose.yml, block analytics-service) va danh sach PUBLIC_GATEWAY_ROUTES cua Gateway
 * deu phu thuoc dung duong dan /api/v1/health nay khong qua xac thuc JWT.
 *
 * 22/08/2026: xac minh bang tay (dung "docker compose stop redis" roi goi /health that) phat hien
 * RedisService.ping() TREO VO HAN khi Redis mat ket noi - mac dinh ioredis KHONG reject lenh ngay,
 * ma xep lenh vao offline queue va cho ket noi lai (retryStrategy back-off toi da 2000ms/lan, toi
 * maxRetriesPerRequest=20 moi reject - co the mat hang phut). Neu khong gioi han thoi gian rieng o
 * day, request /health se treo thay vi tra 503 nhanh - te hon ca ban {status:'ok'} co dinh cu vi
 * Gateway/monitoring cho cau tra loi khong bao gio den. => bat buoc tu dat REDIS_PING_TIMEOUT_MS
 * (Promise.race) cho rieng health check nay, tach biet voi hanh vi ket noi mac dinh cua RedisService
 * (KHONG doi retryStrategy/maxRetriesPerRequest cua client dung chung cho GET /analytics/summary -
 * ngoai pham vi fix nay).
 */
export const REDIS_PING_TIMEOUT_MS = 1000;

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly typeOrmIndicator: TypeOrmHealthIndicator,
    private readonly redisService: RedisService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.healthCheckService.check([
      () => this.typeOrmIndicator.pingCheck('database'),
      () => this.checkRedis(),
    ]);
  }

  /**
   * Indicator thu cong cho Redis (dung de cache GET /analytics/summary, xem
   * analytics/analytics.service.ts) - PING that qua RedisService, khong dung client gia. Gioi han
   * boi REDIS_PING_TIMEOUT_MS (xem ghi chu tren dau file) de KHONG treo /health khi Redis mat ket noi.
   */
  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      await this.withTimeout(this.redisService.ping(), REDIS_PING_TIMEOUT_MS);
      return { redis: { status: 'up' } };
    } catch (error) {
      return { redis: { status: 'down', message: error instanceof Error ? error.message : 'Redis PING that bai' } };
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Redis PING vuot qua ${ms}ms`)), ms);
    });
    // 22/08/2026: `promise` (lenh PING that) KHONG bi huy khi timeout thang - ioredis se tiep tuc
    // xep lenh do o offline queue toi khi ket noi lai hoac maxRetriesPerRequest bi vuot (xem ghi
    // chu tren dau file). Chap nhan duoc trong pham vi /health (chi 1 Promise "mo coi" cho toi khi
    // Redis hoi phuc, khong lam sap tien trinh), doi lai loi ich la health check tra loi dung han.
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }
}
