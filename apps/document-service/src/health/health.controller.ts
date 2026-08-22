import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '@app/common-guard';
import { MinioService } from '../minio/minio.service';

/**
 * 22/08/2026: fix audit "/health chi la liveness, hardcoded {status:'ok'}" - thay bang
 * readiness check thuc su qua @nestjs/terminus: ping Postgres (TypeOrmHealthIndicator, giong
 * cac service khac) VA ping MinIO (bucketExists() qua MinioService.checkConnection(), xem
 * minio.service.ts). Giu nguyen route GET /health (khong doi duong dan) va @Public() vi Docker
 * healthcheck (infra/docker-compose.yml) va PUBLIC_GATEWAY_ROUTES cua Gateway phu thuoc vao
 * duong dan khong xac thuc nay. Body tra ve doi dang so voi truoc (co info/error/details) -
 * khong sao vi Docker healthcheck chi kiem tra statusCode === 200; @HealthCheck() tu dong
 * tra 503 khi co it nhat 1 indicator "down".
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly minioService: MinioService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database'), () => this.checkMinio()]);
  }

  private async checkMinio() {
    const indicator = this.healthIndicatorService.check('minio');
    try {
      await this.minioService.checkConnection();
      return indicator.up();
    } catch (err) {
      return indicator.down({ message: err instanceof Error ? err.message : 'Khong ket noi duoc MinIO' });
    }
  }
}
