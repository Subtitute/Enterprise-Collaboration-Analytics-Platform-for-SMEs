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
import { Folder } from './entities/folder.entity';
import { FileMeta } from './entities/file-meta.entity';
import { FileVersion } from './entities/file-version.entity';
import { FileShare } from './entities/file-share.entity';
// 28/07/2026: entity moi - kiem soat truy cap thu muc (opt-in). Xem folder-share.entity.ts.
import { FolderShare } from './entities/folder-share.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
// 24/10/2026: RAG tai lieu cho Chat bot noi bo - xem rag/rag.module.ts.
import { DocumentChunk } from './entities/document-chunk.entity';
import { RagModule } from './rag/rag.module';
import { KafkaModule } from './kafka/kafka.module';
import { MinioModule } from './minio/minio.module';
import { OutboxModule } from './outbox/outbox.module';
import { FoldersModule } from './folders/folders.module';
import { FilesModule } from './files/files.module';
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
        // 28/07/2026: bo sung FolderShare vao danh sach entity - synchronize: true se tu tao bang
        // `folder_shares` (va cot `visibility` moi tren `folders`) khi service khoi dong.
        // 24/10/2026: bo sung DocumentChunk - synchronize tu tao bang `document_chunks` (va cot
        // `rag_indexed_version` moi tren `file_metas`).
        entities: [Folder, FileMeta, FileVersion, FileShare, FolderShare, OutboxEvent, DocumentChunk],
        // MVP: dung synchronize thay vi migration thu cong - Technical_Spec.md muc 14 (gioi han da biet).
        synchronize: true,
      }),
    }),
    ScheduleModule.forRoot(),
    TerminusModule,
    KafkaModule,
    MinioModule,
    OutboxModule,
    FoldersModule,
    FilesModule,
    RagModule,
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
