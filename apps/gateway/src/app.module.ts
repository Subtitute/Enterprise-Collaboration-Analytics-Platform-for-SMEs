import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AllExceptionsFilter } from '@app/common-guard';
// 04/08/2026: metric Prometheus dung chung (Technical_Spec.md muc 15). MetricsService duoc
// export de main.ts lay ra qua app.get() va gan vao createHttpMetricsMiddleware() cho luu
// luong proxy (khong di qua pipeline Nest nen HttpMetricsInterceptor khong bat duoc).
import { HttpMetricsInterceptor, MetricsController, MetricsService } from '@app/common-metrics';
import configuration from './config/configuration';
import { RedisModule } from './redis/redis.module';
import { HealthController } from './health/health.controller';

/**
 * Gateway KHONG dung InternalAuthGuard/PermissionsGuard (@app/common-guard) - do la guard
 * cho cac service PHIA SAU Gateway tin tuong header noi bo. Gateway la noi TAO ra cac header
 * do (xem src/proxy/inject-auth-headers.ts), nen chi can AllExceptionsFilter de chuan hoa loi
 * cho controller Nest cua no (HealthController/MetricsController) - Technical_Spec.md muc 6, muc 7.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    JwtModule.register({}),
    RedisModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class AppModule {}
