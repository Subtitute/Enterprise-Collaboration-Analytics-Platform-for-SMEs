import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationParticipant } from '../entities/conversation-participant.entity';
import { ParticipantsService } from './participants.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConversationParticipant])],
  providers: [ParticipantsService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
