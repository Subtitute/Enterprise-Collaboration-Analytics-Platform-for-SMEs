import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '@app/common-guard';

/**
 * 22/08/2026: fix audit "/health chi liveness-only" - truoc day tra hardcode {status:'ok'}
 * bat ke ket noi Postgres con song hay khong, khien Docker healthcheck bao container "healthy"
 * du DB da chet. Dung @nestjs/terminus (HealthCheckService + TypeOrmHealthIndicator.pingCheck)
 * de kiem tra that su ket noi TypeORM/Postgres dang dung (xem app.module.ts: TypeOrmModule.forRootAsync).
 * Giu nguyen route GET /health (khong doi duong dan) va @Public() - Docker healthcheck
 * (infra/docker-compose.yml, service project-task-service) va Gateway public-route allowlist
 * phu thuoc dung path nay. Response tra 200 (healthy) hoac 503 (unhealthy) voi body
 * {status, info, error, details} - khac shape cu {status:'ok', service, timestamp}, nhung
 * khong sao vi Docker healthcheck chi kiem tra statusCode === 200, khong doc body.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
