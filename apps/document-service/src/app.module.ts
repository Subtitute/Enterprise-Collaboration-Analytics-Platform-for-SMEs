import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AllExceptionsFilter, InternalAuthGuard, PermissionsGuard } from '@app/common-guard';
import configuration from './config/configuration';
import { Folder } from './entities/folder.entity';
import { FileMeta } from './entities/file-meta.entity';
import { FileVersion } from './entities/file-version.entity';
import { FileShare } from './entities/file-share.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
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
        entities: [Folder, FileMeta, FileVersion, FileShare, OutboxEvent],
        // MVP: dung synchronize thay vi migration thu cong - Technical_Spec.md muc 14 (gioi han da biet).
        synchronize: true,
      }),
    }),
    ScheduleModule.forRoot(),
    KafkaModule,
    MinioModule,
    OutboxModule,
    FoldersModule,
    FilesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: InternalAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
