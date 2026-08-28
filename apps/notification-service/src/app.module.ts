import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TerminusModule } from '@nestjs/terminus';
import { AllExceptionsFilter, InternalAuthGuard, PermissionsGuard } from '@app/common-guard';
// 04/08/2026: metric Prometheus dung chung (Technical_Spec.md muc 15) - xem
// packages/common-metrics/src/index.ts.
import { HttpMetricsInterceptor, MetricsController, MetricsService } from '@app/common-metrics';
import configuration from './config/configuration';
import { RedisModule } from './redis/redis.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';
import { KafkaModule } from './kafka/kafka.module';
import { HealthController } from './health/health.controller';
// 28/07/2026: module moi - man hinh quan tri "Danh sach su kien loi" (Technical_Spec.md muc 14 -
// nang cap Dead Letter Queue). Xem failed-events/failed-events.module.ts.
import { FailedEventsModule } from './failed-events/failed-events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongo.uri'),
      }),
    }),
    // 22/08/2026: fix audit "/health liveness-only" - TerminusModule cung cap HealthCheckService
    // + MongooseHealthIndicator (dung that connection Mongoose mac dinh o tren) cho HealthController.
    TerminusModule,
    RedisModule,
    RealtimeModule,
    NotificationsModule,
    KafkaModule,
    FailedEventsModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    // Endpoint REST cua service nay dung InternalAuthGuard giong IAM (header noi bo do
    // Gateway forward). Rieng WebSocket handshake tu verify JWT truc tiep (xem realtime/).
    { provide: APP_GUARD, useClass: InternalAuthGuard },
    // 22/07/2026: bo sung PermissionsGuard con thieu - 4 service con lai (iam/project-task/
    // document/analytics) deu dang ky ca 2 guard nay cung nhau. Hien tai chua route nao cua
    // NotificationsController dung @RequirePermissions nen guard nay luon cho qua (no-op), nhung
    // thieu no se khien 1 @RequirePermissions duoc them trong tuong lai bi lang le bo qua kiem
    // tra quyen thay vi chan request - giu dong bo voi cac service con lai de phong ngua truoc.
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class AppModule {}
