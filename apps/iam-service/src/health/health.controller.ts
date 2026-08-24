import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '@app/common-guard';
import { RedisService } from '../redis/redis.service';
import { checkRedis } from './redis-health.indicator';

/**
 * 22/08/2026: fix audit "moi /health chi la liveness-only (tra ve {status:'ok'} cung
 * cung bat ke DB con song hay khong)" - doi sang @nestjs/terminus, ping THAT ket noi
 * TypeORM/Postgres cua service nay. Tra ve HTTP 503 (thay vi 200 cung cung) khi mat
 * ket noi DB, de Docker healthcheck (infra/docker-compose.yml) phan anh dung trang thai.
 *
 * 22/08/2026 (bo sung, phat hien qua rieng ra soat): ban dau chi kiem tra Postgres, bo qua Redis
 * du login()/deactivate() (AuthService/UsersService) deu phu thuoc Redis (throttle dang nhap sai,
 * blacklist token/tai khoan bi vo hieu hoa) - Redis chet se khien /health van bao "khoe manh" trong
 * luc 2 co che tren dang fail-open lang le phia sau. Them checkRedis() (mirror
 * apps/gateway/src/health/redis-health.indicator.ts).
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redisService: RedisService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => checkRedis(this.redisService, 'redis'),
    ]);
  }
}
