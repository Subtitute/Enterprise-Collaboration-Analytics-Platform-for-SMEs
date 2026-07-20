import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AllExceptionsFilter, InternalAuthGuard } from '@app/common-guard';
import configuration from './config/configuration';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';
import { KafkaModule } from './kafka/kafka.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongo.uri'),
      }),
    }),
    RealtimeModule,
    NotificationsModule,
    KafkaModule,
  ],
  controllers: [HealthController],
  providers: [
    // Endpoint REST cua service nay dung InternalAuthGuard giong IAM (header noi bo do
    // Gateway forward). Rieng WebSocket handshake tu verify JWT truc tiep (xem realtime/).
    { provide: APP_GUARD, useClass: InternalAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
