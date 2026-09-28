import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { PERMISSIONS } from '@app/common-dto';
import { Conversation } from '../entities/conversation.entity';
import { ConversationParticipant } from '../entities/conversation-participant.entity';
import { Message } from '../entities/message.entity';
import { ConversationType } from '../entities/conversation-type.enum';
import { ParticipantsService } from '../participants/participants.service';
import { MessagingGateway } from '../realtime/messaging.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateParticipantsDto } from './dto/update-participants.dto';

export interface ConversationWithParticipants {
  id: string;
  organizationId: string;
  type: ConversationType;
  name: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  participantUserIds: string[];
}

export interface ConversationListItem {
  id: string;
  type: ConversationType;
  name: string | null;
  createdBy: string;
  participantUserIds: string[];
  lastMessage: { body: string; senderId: string; createdAt: Date } | null;
  unreadCount: number;
}

@Injectable()
export class ConversationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Conversation) private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
    private readonly participantsService: ParticipantsService,
    private readonly gateway: MessagingGateway,
  ) {}

  /**
   * POST /conversations. DIRECT: dedup - tra ve cuoc tro chuyen DIRECT co san giua dung 2 nguoi
   * nay trong to chuc thay vi tao trung (idempotent). GROUP: `name` bat buoc, validate o day (khong
   * o DTO) vi dieu kien nay phu thuoc vao `type` - xem chu thich CreateConversationDto.
   */
  async create(
    organizationId: string,
    callerId: string,
    dto: CreateConversationDto,
  ): Promise<ConversationWithParticipants> {
    if (dto.type === ConversationType.GROUP) {
      if (!dto.name || !dto.name.trim()) {
        throw new BadRequestException('Ten nhom la bat buoc doi voi cuoc tro chuyen nhom (GROUP)');
      }
      const conversation = await this.createGroup(organizationId, callerId, dto.name.trim(), dto.participantUserIds);
      this.gateway.emitNewConversation(conversation, conversation.participantUserIds);
      return conversation;
    }

    return this.createOrReuseDirect(organizationId, callerId, dto.participantUserIds);
  }

  /** GET /conversations - danh sach cuoc tro chuyen cua caller, sap xep theo hoat dong gan nhat. */
  async findAllForUser(organizationId: string, callerId: string): Promise<ConversationListItem[]> {
    const myParticipations = await this.participantsService.listByUserId(callerId);
    if (myParticipations.length === 0) return [];

    const lastReadByConversation = new Map(myParticipations.map((p) => [p.conversationId, p.lastReadAt ?? null]));
    const conversationIds = myParticipations.map((p) => p.conversationId);

    const conversations = await this.conversationRepo.find({
      where: { id: In(conversationIds), organizationId },
    });
    const allParticipants = await this.participantsService.listByConversationIds(conversationIds);
    const participantsByConversation = new Map<string, string[]>();
    for (const p of allParticipants) {
      const list = participantsByConversation.get(p.conversationId) ?? [];
      list.push(p.userId);
      participantsByConversation.set(p.conversationId, list);
    }

    // Quy mo SME (~10-200 nhan su, General_idea.md muc 7) - so cuoc tro chuyen/nguoi nho, nen dung
    // 1 truy van nho MOI cuoc tro chuyen (song song qua Promise.all) thay vi 1 aggregate GROUP BY
    // duy nhat: nguong "chua doc" (lastReadAt) khac nhau theo TUNG cuoc tro chuyen/nguoi goi, khong
    // giong dieu kien dong nhat cua CustomersService.computeCustomerStats() (mirror khong ap dung o day).
    const items = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await this.messageRepo.findOne({
          where: { conversationId: conv.id, deletedAt: IsNull() },
          order: { createdAt: 'DESC' },
        });
        const lastReadAt = lastReadByConversation.get(conv.id) ?? null;
        const unreadCount = await this.messageRepo.count({
          where: {
            conversationId: conv.id,
            deletedAt: IsNull(),
            // Tin nhan cua chinh minh khong tinh la "chua doc" - nguoi gui hien nhien da "doc" cai
            // minh vua go.
            senderId: Not(callerId),
            ...(lastReadAt ? { createdAt: MoreThan(lastReadAt) } : {}),
          },
        });
        return {
          conv,
          item: {
            id: conv.id,
            type: conv.type,
            name: conv.name ?? null,
            createdBy: conv.createdBy,
            participantUserIds: participantsByConversation.get(conv.id) ?? [],
            lastMessage: lastMessage
              ? { body: lastMessage.body, senderId: lastMessage.senderId, createdAt: lastMessage.createdAt }
              : null,
            unreadCount,
          } as ConversationListItem,
        };
      }),
    );

    items.sort((a, b) => {
      const aTime = (a.item.lastMessage?.createdAt ?? a.conv.createdAt).getTime();
      const bTime = (b.item.lastMessage?.createdAt ?? b.conv.createdAt).getTime();
      return bTime - aTime;
    });

    return items.map((x) => x.item);
  }

  /** PATCH /conversations/:id/read - cap nhat lastReadAt = now cho caller trong cuoc tro chuyen nay. */
  async markRead(organizationId: string, conversationId: string, callerId: string): Promise<void> {
    await this.findConversationOrFail(organizationId, conversationId);
    await this.participantsService.assertParticipant(conversationId, callerId);
    await this.participantsService.markRead(conversationId, callerId);
  }

  /**
   * PATCH /conversations/:id/participants - CHI ap dung cho GROUP (400 cho DIRECT). Chi
   * `createdBy` HOAC nguoi giu PERMISSIONS.MESSAGE_MANAGE_GROUP moi duoc goi - day la dieu kien
   * "OR" nen KHONG the bieu dien bang @RequirePermissions() don thuan tren controller (se chan
   * nham chinh nguoi tao nhom neu ho khong giu quyen quan ly nhom), phai tu kiem tra o day.
   */
  async updateParticipants(
    organizationId: string,
    conversationId: string,
    callerId: string,
    callerPermissions: string[],
    dto: UpdateParticipantsDto,
  ): Promise<ConversationWithParticipants> {
    const conversation = await this.findConversationOrFail(organizationId, conversationId);
    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Chi cuoc tro chuyen nhom (GROUP) moi quan ly duoc danh sach thanh vien');
    }

    const isOwner = conversation.createdBy === callerId;
    const canManage = callerPermissions.includes(PERMISSIONS.MESSAGE_MANAGE_GROUP);
    if (!isOwner && !canManage) {
      throw new ForbiddenException('Chi nguoi tao nhom hoac nguoi co quyen quan ly nhom moi duoc thay doi thanh vien');
    }

    const addUserIds = dto.addUserIds ?? [];
    const removeUserIds = dto.removeUserIds ?? [];
    const affectedUserIds = new Set([...addUserIds, ...removeUserIds]);

    if (addUserIds.length > 0) await this.participantsService.addMany(conversationId, addUserIds);
    if (removeUserIds.length > 0) await this.participantsService.removeMany(conversationId, removeUserIds);

    const participantUserIds = await this.participantsService.listUserIds(conversationId);
    const response: ConversationWithParticipants = { ...conversation, participantUserIds };

    // "Anh huong" = thanh vien CON LAI (thay doi thanh phan nhom ho dang xem) + thanh vien VUA BI
    // XOA (can bao de client go cuoc tro chuyen nay khoi danh sach, ho khong con o room nua).
    for (const userId of participantUserIds) affectedUserIds.add(userId);
    this.gateway.emitConversationUpdated(response, [...affectedUserIds]);

    return response;
  }

  /** Tao GROUP moi - caller luon duoc them vao (dedup qua Set, tranh trung neu caller tu liet ke chinh minh). */
  private async createGroup(
    organizationId: string,
    callerId: string,
    name: string,
    participantUserIds: string[],
  ): Promise<ConversationWithParticipants> {
    const memberIds = Array.from(new Set([callerId, ...participantUserIds]));

    return this.dataSource.transaction(async (manager) => {
      const conversation = await manager.save(
        manager.create(Conversation, { organizationId, type: ConversationType.GROUP, name, createdBy: callerId }),
      );
      await manager.save(
        ConversationParticipant,
        memberIds.map((userId) => manager.create(ConversationParticipant, { conversationId: conversation.id, userId })),
      );
      return { ...conversation, participantUserIds: memberIds };
    });
  }

  /** DIRECT: dung 1 nguoi nhan, tra ve cuoc tro chuyen co san neu da ton tai (idempotent), khong tao trung. */
  private async createOrReuseDirect(
    organizationId: string,
    callerId: string,
    participantUserIds: string[],
  ): Promise<ConversationWithParticipants> {
    if (participantUserIds.length !== 1) {
      throw new BadRequestException('Cuoc tro chuyen truc tiep (DIRECT) phai co dung 1 nguoi nhan');
    }
    const otherUserId = participantUserIds[0];
    if (otherUserId === callerId) {
      throw new BadRequestException('Khong the tao cuoc tro chuyen truc tiep voi chinh minh');
    }

    const existing = await this.findExistingDirectConversation(organizationId, callerId, otherUserId);
    if (existing) {
      return { ...existing, participantUserIds: [callerId, otherUserId] };
    }

    const conversation = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(Conversation, { organizationId, type: ConversationType.DIRECT, name: null, createdBy: callerId }),
      );
      await manager.save(ConversationParticipant, [
        manager.create(ConversationParticipant, { conversationId: created.id, userId: callerId }),
        manager.create(ConversationParticipant, { conversationId: created.id, userId: otherUserId }),
      ]);
      return created;
    });

    const response: ConversationWithParticipants = { ...conversation, participantUserIds: [callerId, otherUserId] };
    this.gateway.emitNewConversation(response, response.participantUserIds);
    return response;
  }

  /** DIRECT luon dung 2 thanh vien co dinh tu luc tao (khong co PATCH participants cho DIRECT), nen
   * chi can join ton tai participant cua CA 2 nguoi la du xac dinh dung 1 cuoc tro chuyen. */
  private async findExistingDirectConversation(
    organizationId: string,
    userA: string,
    userB: string,
  ): Promise<Conversation | null> {
    const found = await this.conversationRepo
      .createQueryBuilder('c')
      .innerJoin('conversation_participants', 'p1', 'p1.conversation_id = c.id AND p1.user_id = :userA', { userA })
      .innerJoin('conversation_participants', 'p2', 'p2.conversation_id = c.id AND p2.user_id = :userB', { userB })
      .where('c.organization_id = :organizationId', { organizationId })
      .andWhere('c.type = :type', { type: ConversationType.DIRECT })
      .getOne();
    return found ?? null;
  }

  private async findConversationOrFail(organizationId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({ where: { id: conversationId, organizationId } });
    if (!conversation) throw new NotFoundException('Khong tim thay cuoc tro chuyen');
    return conversation;
  }
}
