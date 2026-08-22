import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { AllExceptionsFilter, InternalAuthGuard, PermissionsGuard } from '@app/common-guard';
import { HttpMetricsInterceptor, MetricsController, MetricsService } from '@app/common-metrics';
import configuration from './config/configuration';
import { Attendance } from './entities/attendance.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { KafkaModule } from './kafka/kafka.module';
import { MinioModule } from './minio/minio.module';
import { OutboxModule } from './outbox/outbox.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('db.host'),
        port: config.get<number>('db.port'),
        username: config.get<string>('db.user'),
        password: config.get<string>('db.password'),
        database: config.get<string>('db.name'),
        entities: [Attendance, LeaveRequest, OutboxEvent],
        // MVP: dung synchronize thay vi migration thu cong - Technical_Spec.md muc 14 (gioi han da biet).
        synchronize: true,
      }),
    }),
    ScheduleModule.forRoot(),
    // 22/08/2026: can cho HealthController dung TypeOrmHealthIndicator (fix audit /health
    // liveness-only) - xem apps/hrm-service/src/health/health.controller.ts.
    TerminusModule,
    KafkaModule,
    MinioModule,
    OutboxModule,
    AttendanceModule,
    LeaveRequestsModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    { provide: APP_GUARD, useClass: InternalAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class AppModule {}
