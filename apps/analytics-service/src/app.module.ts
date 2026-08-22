import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';
import { DataSource, DataSourceOptions } from 'typeorm';
// 04/08/2026: metric Prometheus dung chung (Technical_Spec.md muc 15) - xem
// packages/common-metrics/src/index.ts.
import { HttpMetricsInterceptor, MetricsController, MetricsService } from '@app/common-metrics';
// 28/07/2026: DDL tu-cham schema KPI theo phong ban (dim_user, fact_task_events.assignee_id) -
// xem giai thich day du va ly do can ca 2 noi (o day VA infra/timescale-init/001-init.sql) trong
// database/schema-bootstrap.ts.
import { bootstrapDepartmentKpiSchema } from './database/schema-bootstrap';
import { AllExceptionsFilter, InternalAuthGuard, PermissionsGuard } from '@app/common-guard';
import configuration from './config/configuration';
import { RedisModule } from './redis/redis.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { KafkaModule } from './kafka/kafka.module';
import { HealthController } from './health/health.controller';
// 28/07/2026: tinh nang "Nhan xet AI" (GET /analytics/ai-insights) - hang muc dau tien trong
// loat nang cap AI, xem ai-insights/ai-insights.service.ts.
import { AiInsightsModule } from './ai-insights/ai-insights.module';

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
        // QUAN TRONG: schema (hypertable fact_task_events/fact_document_events/fact_user_activity
        // + continuous aggregate daily_task_summary/weekly_project_progress/daily_document_activity)
        // da duoc so huu HOAN TOAN boi infra/timescale-init/001-init.sql (chay tu dong khi container
        // TimescaleDB khoi tao lan dau). KHONG khai bao TypeORM entity va KHONG dung synchronize cho
        // cac bang nay - hypertable/continuous aggregate la khai niem rieng cua TimescaleDB, khong map
        // duoc vao ORM entity model. DataSource o day CHI dong vai tro connection pool; moi truy van
        // deu la raw SQL tham so hoa qua dataSource.query() (xem analytics/*.service.ts).
        entities: [],
        synchronize: false,
      }),
      // 28/07/2026: `dataSourceFactory` tuy chon cua TypeOrmModule.forRootAsync - tu khoi tao
      // DataSource (thay vi de @nestjs/typeorm tu lam) de chay bootstrapDepartmentKpiSchema()
      // NGAY SAU KHI ket noi thanh cong nhung TRUOC KHI DataSource duoc tra ve cho Nest DI
      // container. Viec nay xay ra trong giai doan KHOI TAO PROVIDER (truoc khi bat ky
      // onModuleInit nao chay), nen dam bao DDL nay LUON hoan tat truoc khi
      // KafkaConsumerService.onModuleInit() bat dau consume va co the ghi vao dim_user/
      // fact_task_events.assignee_id (xem kafka-consumer.service.ts) - khong phu thuoc vao thu
      // tu khoi tao module cua Nest (thu tu do KHONG duoc dam bao ro rang giua cac module anh
      // em nhu AnalyticsModule/KafkaModule).
      dataSourceFactory: async (options?: DataSourceOptions) => {
        const dataSource = new DataSource(options!);
        await dataSource.initialize();
        await bootstrapDepartmentKpiSchema(dataSource);
        return dataSource;
      },
    }),
    RedisModule,
    AnalyticsModule,
    KafkaModule,
    AiInsightsModule,
    // 22/08/2026: fix audit "/health liveness-only" - cung cap HealthCheckService/
    // TypeOrmHealthIndicator cho HealthController (xem health/health.controller.ts).
    TerminusModule,
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
