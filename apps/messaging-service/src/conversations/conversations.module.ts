import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { ParticipantsModule } from '../participants/participants.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { ConversationsController } from './conversations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message]), ParticipantsModule, RealtimeModule],
  providers: [ConversationsService, MessagesService],
  controllers: [ConversationsController],
  exports: [ConversationsService, MessagesService],
})
export class ConversationsModule {}
