import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { Public } from '@app/common-guard';

/**
 * 22/08/2026: fix audit "moi /health chi la liveness-only" - endpoint cu tra hardcoded
 * { status: 'ok' } bat ke dependency that su co song hay khong. Service nay dung MongoDB
 * (@nestjs/mongoose, KHONG phai TypeORM/Postgres nhu da so service con lai) nen dung
 * MongooseHealthIndicator.pingCheck de kiem tra that ket noi Mongoose mac dinh (duoc dang ky
 * boi MongooseModule.forRootAsync trong app.module.ts). @nestjs/terminus se tra 200 khi 'ok',
 * 503 khi 'error' (xem TerminusModule trong app.module.ts) - Docker healthcheck
 * (infra/docker-compose.yml, block notification-service) chi kiem tra statusCode === 200 nen
 * khong can doi gi them o phia do. Route va @Public() giu nguyen (Gateway public-route allowlist
 * + Docker healthcheck phu thuoc dung path GET /health khong xac thuc).
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.mongoose.pingCheck('mongodb')]);
  }
}
