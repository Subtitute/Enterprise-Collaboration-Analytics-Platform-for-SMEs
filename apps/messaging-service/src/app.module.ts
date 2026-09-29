import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';
import { AllExceptionsFilter, InternalAuthGuard, PermissionsGuard } from '@app/common-guard';
import { HttpMetricsInterceptor, MetricsController, MetricsService } from '@app/common-metrics';
import configuration from './config/configuration';
import { Conversation } from './entities/conversation.entity';
import { ConversationParticipant } from './entities/conversation-participant.entity';
import { Message } from './entities/message.entity';
import { RedisModule } from './redis/redis.module';
import { ParticipantsModule } from './participants/participants.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ConversationsModule } from './conversations/conversations.module';
import { HealthController } from './health/health.controller';

// 28/09/2026: toi KHONG wire KafkaModule/OutboxModule cho service nay, khac voi moi service con lai
// trong repo (CRM/HRM/Project-Task/Document/IAM deu phat domain event qua Outbox->Kafka). Ly do: tin
// nhan noi bo KHONG co bat ky service nao khac can tieu thu - Task/Document/User event co nhieu
// consumer thuc su (Notification, Analytics, ML...), con 1 tin nhan chat thi chi nguoi gui va cac
// thanh vien cuoc tro chuyen do can biet, va ho da duoc bao truc tiep qua WebSocket ngay khi REST
// handler luu xong (xem realtime/messaging.gateway.ts). Them Outbox/Kafka o day chi la chi phi/do
// phuc tap thua, khong phuc vu nhu cau nao.
//
// 28/09/2026: toi cung KHONG luu cache ten/email nguoi dung (kieu dim_user) - moi noi trong service
// nay (Conversation.createdBy, ConversationParticipant.userId, Message.senderId) chi luu userId
// dang string. Du an vua don cong suc sua loi "ban ghi ma" (dim_user cache cu tro toi user da bi
// xoa) o analytics-service/ml-service/notification-service; phan giai id -> ten hien thi hoan toan
// o phia client (web/mobile da co san danh sach user cua to chuc de map id -> ten).
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
        entities: [Conversation, ConversationParticipant, Message],
        // MVP: dung synchronize thay vi migration thu cong, mirror moi service con lai trong repo
        // (Technical_Spec.md muc 14 - gioi han da biet).
        synchronize: true,
      }),
    }),
    TerminusModule,
    RedisModule,
    ParticipantsModule,
    RealtimeModule,
    ConversationsModule,
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
