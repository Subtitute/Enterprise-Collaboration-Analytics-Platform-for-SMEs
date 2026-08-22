import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '@app/common-guard';

/**
 * 22/08/2026: fix audit "moi /health chi la liveness-only (tra ve {status:'ok'} cung
 * cung bat ke DB con song hay khong)" - doi sang @nestjs/terminus, ping THAT ket noi
 * TypeORM/Postgres cua service nay. Tra ve HTTP 503 (thay vi 200 cung cung) khi mat
 * ket noi DB, de Docker healthcheck (infra/docker-compose.yml) phan anh dung trang thai.
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
