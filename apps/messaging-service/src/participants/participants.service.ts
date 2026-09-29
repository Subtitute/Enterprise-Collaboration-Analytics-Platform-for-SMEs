import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConversationParticipant } from '../entities/conversation-participant.entity';

/**
 * Truy van/thay doi danh sach thanh vien cuoc tro chuyen. Tach rieng khoi ConversationsModule
 * (module rieng, khong phu thuoc realtime/) de RealtimeModule (MessagingGateway) va
 * ConversationsModule cung dung duoc ma khong tao vong phu thuoc module (Gateway can kiem tra
 * quyen tham gia room, ConversationsModule can phat su kien qua Gateway).
 */
@Injectable()
export class ParticipantsService {
  constructor(
    @InjectRepository(ConversationParticipant)
    private readonly participantRepo: Repository<ConversationParticipant>,
  ) {}

  findOne(conversationId: string, userId: string): Promise<ConversationParticipant | null> {
    return this.participantRepo.findOne({ where: { conversationId, userId } });
  }

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const found = await this.findOne(conversationId, userId);
    return !!found;
  }

  /** Dung cho REST (403) - khac isParticipant() (dung cho Gateway, chi tu choi join room, khong nem loi). */
  async assertParticipant(conversationId: string, userId: string): Promise<ConversationParticipant> {
    const participant = await this.findOne(conversationId, userId);
    if (!participant) {
      throw new ForbiddenException('Ban khong phai thanh vien cua cuoc tro chuyen nay');
    }
    return participant;
  }

  listByConversation(conversationId: string): Promise<ConversationParticipant[]> {
    return this.participantRepo.find({ where: { conversationId } });
  }

  /** Dung cho GET /conversations - nap tat ca thanh vien cua NHIEU cuoc tro chuyen trong 1 truy van. */
  listByConversationIds(conversationIds: string[]): Promise<ConversationParticipant[]> {
    if (conversationIds.length === 0) return Promise.resolve([]);
    return this.participantRepo.find({ where: { conversationId: In(conversationIds) } });
  }

  /** Dung cho GET /conversations - danh sach cuoc tro chuyen (kem lastReadAt) ma 1 user tham gia. */
  listByUserId(userId: string): Promise<ConversationParticipant[]> {
    return this.participantRepo.find({ where: { userId } });
  }

  async listUserIds(conversationId: string): Promise<string[]> {
    const rows = await this.listByConversation(conversationId);
    return rows.map((row) => row.userId);
  }

  /** Bo qua userId da la thanh vien san (idempotent) - dung cho tao GROUP va PATCH participants. */
  async addMany(conversationId: string, userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      const exists = await this.isParticipant(conversationId, userId);
      if (!exists) {
        await this.participantRepo.save(this.participantRepo.create({ conversationId, userId }));
      }
    }
  }

  async removeMany(conversationId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await this.participantRepo.delete({ conversationId, userId: In(userIds) });
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.participantRepo.update({ conversationId, userId }, { lastReadAt: new Date() });
  }
}
