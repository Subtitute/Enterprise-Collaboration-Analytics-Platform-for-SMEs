import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '@app/common-guard';

/**
 * Health check that thuc su kiem tra ket noi Postgres (khong con hardcode { status: 'ok' }).
 * TerminusModule tra ve HTTP 200 + { status: 'ok', ... } khi khoe manh, hoac 503 +
 * { status: 'error', ... } khi mat ket noi DB - Docker healthcheck (infra/docker-compose.yml,
 * crm-service block) chi kiem tra r.statusCode === 200 nen hanh vi container healthy/unhealthy
 * phan anh dung tinh trang dependency that.
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
