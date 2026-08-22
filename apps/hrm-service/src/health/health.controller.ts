import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '@app/common-guard';

/**
 * 22/08/2026: fix audit "moi /health chi la liveness-only (tra ve {status:'ok'} cung
 * cung bat ke DB con song hay khong)" - doi sang @nestjs/terminus, ping THAT ket noi
 * TypeORM/Postgres cua service nay. Tra ve HTTP 503 (thay vi 200 cung cung) khi mat
 * ket noi DB, de Docker healthcheck (infra/docker-compose.yml) phan anh dung trang thai.
 * Mirror apps/iam-service/src/health/health.controller.ts (cung fix, cung ngay).
 *
 * Khong them check cho MinIO (attendance photo-proof storage, xem src/minio/minio.service.ts):
 * Postgres la dependency chinh - MOI request (kha nang toan bo API) deu can DB, con MinIO chi anh
 * huong nhanh check-in/check-out (upload anh). Client MinIO dang duoc tao trong onModuleInit() va
 * khong expose ra ngoai (khong co san ham ping/bucketExists cong khai) - them check se can sua
 * MinioService chi de phuc vu health check, va se khien Docker/orchestrator restart toan bo service
 * (bao gom cac endpoint khong lien quan MinIO) chi vi MinIO cham tam thoi. Loi MinIO khi upload anh
 * van duoc bao ro qua HTTP 500 tai chinh endpoint checkIn()/checkOut() (khong bi che giau).
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
