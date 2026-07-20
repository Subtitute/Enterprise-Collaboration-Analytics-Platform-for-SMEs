import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AllExceptionsFilter } from '@app/common-guard';
import configuration from './config/configuration';
import { RedisModule } from './redis/redis.module';
import { HealthController } from './health/health.controller';

/**
 * Gateway KHONG dung InternalAuthGuard/PermissionsGuard (@app/common-guard) - do la guard
 * cho cac service PHIA SAU Gateway tin tuong header noi bo. Gateway la noi TAO ra cac header
 * do (xem src/proxy/inject-auth-headers.ts), nen chi can AllExceptionsFilter de chuan hoa loi
 * cho controller Nest duy nhat (HealthController) - Technical_Spec.md muc 6, muc 7.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    JwtModule.register({}),
    RedisModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
