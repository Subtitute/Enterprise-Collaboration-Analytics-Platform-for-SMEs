import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { ParticipantsService } from '../participants/participants.service';
import { MessagingGateway } from '../realtime/messaging.gateway';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation) private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
    private readonly participantsService: ParticipantsService,
    private readonly gateway: MessagingGateway,
  ) {}

  /**
   * GET /conversations/:id/messages - phan trang kieu cursor (beforeMessageId, khong dung
   * page/limit) vi lich su chat luon duoc tai LUI theo thoi gian (infinite scroll), moi trang KHONG
   * dich chuyen khi co tin nhan moi duoc gui trong luc dang cuon - khac han danh sach Customer/Deal
   * (page/limit) vi du lieu do khong lien tuc them ban ghi moi tuong tu.
   */
  async listMessages(
    organizationId: string,
    conversationId: string,
    callerId: string,
    limit: number,
    beforeMessageId?: string,
  ): Promise<Message[]> {
    await this.assertConversationInOrg(organizationId, conversationId);
    await this.participantsService.assertParticipant(conversationId, callerId);

    const qb = this.messageRepo
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .andWhere('message.deletedAt IS NULL')
      .orderBy('message.createdAt', 'DESC')
      .take(limit);

    if (beforeMessageId) {
      const cursor = await this.messageRepo.findOne({ where: { id: beforeMessageId, conversationId } });
      if (cursor) qb.andWhere('message.createdAt < :cursorCreatedAt', { cursorCreatedAt: cursor.createdAt });
    }

    const page = await qb.getMany();
    return page.reverse();
  }

  /** POST /conversations/:id/messages - luu tin nhan roi day qua WebSocket (message:new). */
  async sendMessage(
    organizationId: string,
    conversationId: string,
    callerId: string,
    dto: SendMessageDto,
  ): Promise<Message> {
    await this.assertConversationInOrg(organizationId, conversationId);
    await this.participantsService.assertParticipant(conversationId, callerId);

    const message = await this.messageRepo.save(
      this.messageRepo.create({ conversationId, senderId: callerId, body: dto.body }),
    );

    const participantUserIds = await this.participantsService.listUserIds(conversationId);
    this.gateway.emitNewMessage(conversationId, message, participantUserIds);
    return message;
  }

  /**
   * DELETE /conversations/:id/messages/:messageId - xoa mem tin nhan CUA CHINH NGUOI GUI. Khong
   * nam trong 6 endpoint liet ke trong dac ta REST goc, nhung Message.deletedAt (bat buoc theo mo
   * hinh du lieu) can 1 duong dan de thuc su duoc dat gia tri - neu khong cot nay se khong bao gio
   * duoc ghi boi bat ky luong nao.
   */
  async deleteMessage(conversationId: string, messageId: string, callerId: string): Promise<void> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId, conversationId, deletedAt: IsNull() },
    });
    if (!message) throw new NotFoundException('Khong tim thay tin nhan');
    if (message.senderId !== callerId) {
      throw new ForbiddenException('Chi nguoi gui moi duoc xoa tin nhan cua minh');
    }
    message.deletedAt = new Date();
    await this.messageRepo.save(message);
  }

  private async assertConversationInOrg(organizationId: string, conversationId: string): Promise<void> {
    const conversation = await this.conversationRepo.findOne({ where: { id: conversationId, organizationId } });
    if (!conversation) throw new NotFoundException('Khong tim thay cuoc tro chuyen');
  }
}
