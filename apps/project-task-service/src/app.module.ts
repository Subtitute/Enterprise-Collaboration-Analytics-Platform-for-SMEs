import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { AllExceptionsFilter, InternalAuthGuard, PermissionsGuard } from '@app/common-guard';
// 04/08/2026: metric Prometheus dung chung (Technical_Spec.md muc 15) - xem
// packages/common-metrics/src/index.ts.
import { HttpMetricsInterceptor, MetricsController, MetricsService } from '@app/common-metrics';
import configuration from './config/configuration';
import { Project } from './entities/project.entity';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskStatusHistory } from './entities/task-status-history.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { KafkaModule } from './kafka/kafka.module';
import { OutboxModule } from './outbox/outbox.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
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
        entities: [Project, Task, TaskAssignee, TaskComment, TaskStatusHistory, OutboxEvent],
        // MVP: dung synchronize thay vi migration thu cong - Technical_Spec.md muc 14 (gioi han da biet).
        synchronize: true,
      }),
    }),
    ScheduleModule.forRoot(),
    // 22/08/2026: TerminusModule - fix audit "/health chi liveness, khong kiem tra DB that"
    // (xem health.controller.ts: TypeOrmHealthIndicator.pingCheck kiem tra ket noi Postgres that su).
    TerminusModule,
    KafkaModule,
    OutboxModule,
    ProjectsModule,
    TasksModule,
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
