import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '@app/common-guard';

/**
 * Health check that su kiem tra ket noi Postgres (khong hardcode { status: 'ok' }) - mirror
 * apps/hrm-service/src/health/health.controller.ts (cung co MinIO nhu service nay).
 *
 * Khong check MinIO (anh san pham, src/minio/minio.service.ts) - mirror dung ly do da ghi tai
 * hrm-service: Postgres la dependency CHINH (moi request deu can), MinIO chi anh huong upload/xem
 * anh san pham. Loi MinIO van bao ro qua HTTP 500 ngay tai endpoint lien quan, khong bi che giau.
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
