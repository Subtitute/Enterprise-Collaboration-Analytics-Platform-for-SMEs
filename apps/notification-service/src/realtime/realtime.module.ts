import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsGateway } from './notifications.gateway';

/**
 * Module chua WebSocket Gateway. Tach rieng khoi NotificationsModule de tranh phu thuoc
 * vong: KafkaModule -> NotificationsModule -> RealtimeModule (Gateway).
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
      }),
    }),
  ],
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class RealtimeModule {}
