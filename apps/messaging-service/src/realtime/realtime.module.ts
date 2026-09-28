import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ParticipantsModule } from '../participants/participants.module';
import { MessagingGateway } from './messaging.gateway';

/**
 * Module chua WebSocket Gateway - tach rieng mirror apps/notification-service/src/realtime/realtime.module.ts
 * (tranh phu thuoc vong: ConversationsModule -> RealtimeModule (Gateway) -> ParticipantsModule,
 * KHONG nguoc lai).
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
    ParticipantsModule,
  ],
  providers: [MessagingGateway],
  exports: [MessagingGateway],
})
export class RealtimeModule {}
