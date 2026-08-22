import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '@app/common-guard';
import { RedisService } from '../redis/redis.service';
import { checkRedis } from './redis-health.indicator';

/**
 * 22/08/2026: fix audit "moi /health chi la liveness-only (tra ve {status:'ok'} cung cung bat
 * ke dependency that su co song hay khong)" - doi sang @nestjs/terminus. Gateway KHONG co DB
 * rieng (pure reverse-proxy, xem header src/proxy/setup-gateway.ts) nen khong dung
 * TypeOrmHealthIndicator/MongooseHealthIndicator nhu 7 service nghiep vu con lai; dependency
 * that su can kiem tra o day la Redis (rate-limit + JWT blacklist, xem
 * src/redis/redis.service.ts). Terminus khong co san indicator cho ioredis nen tu viet
 * checkRedis() (xem redis-health.indicator.ts). Tra ve HTTP 503 (thay vi 200 cung cung) khi mat
 * ket noi Redis, de Docker healthcheck (infra/docker-compose.yml, block gateway) phan anh dung
 * trang thai.
 *
 * Duong dan /api/v1/health van nam trong PUBLIC_GATEWAY_ROUTES (xem
 * src/proxy/jwt-auth.middleware.ts) nen middleware xac thuc JWT se bo qua truoc khi request toi
 * duoc day toi day - do la co che chinh giu route nay khong xac thuc tren Gateway. @Public()
 * duoc giu lai de nhat quan voi HealthController cua cac service khac (hien Gateway KHONG dang
 * ky guard nao doc IS_PUBLIC_KEY trong app.module.ts nen decorator nay hien chi la tai lieu/du
 * phong cho tuong lai, khong anh huong hanh vi thuc te).
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly redisService: RedisService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => checkRedis(this.redisService, 'redis')]);
  }
}
