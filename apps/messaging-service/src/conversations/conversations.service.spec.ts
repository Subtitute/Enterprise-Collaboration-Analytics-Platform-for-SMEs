import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '@app/common-dto';
import { ConversationsService } from './conversations.service';
import { ConversationType } from '../entities/conversation-type.enum';

/**
 * Unit test cho ConversationsService - mock thu cong DataSource/Repository/ParticipantsService/
 * MessagingGateway (khong boot NestJS module hay DB that), mirror
 * apps/crm-service/src/customers/customers.service.spec.ts. Tap trung vao: DIRECT dedup (khong tao
 * trung neu da co cuoc tro chuyen giua 2 nguoi), tinh unreadCount, va dieu kien uy quyen OR cua
 * updateParticipants (createdBy HOAC MESSAGE_MANAGE_GROUP).
 */
describe('ConversationsService', () => {
  const organizationId = 'org-1';
  const callerId = 'user-1';
  const otherUserId = 'user-2';

  /** QueryBuilder gia lap chain duoc (innerJoin/where/andWhere) roi tra ve ket qua o getOne(). */
  function makeDirectQueryBuilder(result: unknown) {
    const qb: any = {};
    qb.innerJoin = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.getOne = jest.fn().mockResolvedValue(result);
    return qb;
  }

  describe('create - DIRECT', () => {
    it('tra ve cuoc tro chuyen DIRECT co san giua dung 2 nguoi nay thay vi tao trung (idempotent)', async () => {
      const existing = { id: 'conv-existing', organizationId, type: ConversationType.DIRECT, name: null, createdBy: callerId };
      const conversationRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(makeDirectQueryBuilder(existing)) };
      const dataSourceMock = { transaction: jest.fn() };
      const gatewayMock = { emitNewConversation: jest.fn() };
      const service = new ConversationsService(
        dataSourceMock as any,
        conversationRepoMock as any,
        {} as any,
        {} as any,
        gatewayMock as any,
      );

      const result = await service.create(organizationId, callerId, {
        type: ConversationType.DIRECT,
        participantUserIds: [otherUserId],
      });

      expect(result).toMatchObject({ id: 'conv-existing', participantUserIds: [callerId, otherUserId] });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
      expect(gatewayMock.emitNewConversation).not.toHaveBeenCalled();
    });

    it('tao moi (transaction) + phat conversation:new neu CHUA co cuoc tro chuyen DIRECT nao giua 2 nguoi', async () => {
      const conversationRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(makeDirectQueryBuilder(null)) };
      const managerMock = {
        create: jest.fn().mockImplementation((_entity: unknown, data: unknown) => data),
        save: jest
          .fn()
          .mockImplementationOnce((data: any) => Promise.resolve({ id: 'conv-new', ...data }))
          .mockImplementationOnce(() => Promise.resolve(undefined)),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const gatewayMock = { emitNewConversation: jest.fn() };
      const service = new ConversationsService(
        dataSourceMock as any,
        conversationRepoMock as any,
        {} as any,
        {} as any,
        gatewayMock as any,
      );

      const result = await service.create(organizationId, callerId, {
        type: ConversationType.DIRECT,
        participantUserIds: [otherUserId],
      });

      expect(result).toMatchObject({ id: 'conv-new', type: ConversationType.DIRECT, participantUserIds: [callerId, otherUserId] });
      expect(gatewayMock.emitNewConversation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'conv-new' }),
        [callerId, otherUserId],
      );
    });

    it('nem BadRequestException neu participantUserIds khong dung 1 phan tu', async () => {
      const service = new ConversationsService({} as any, {} as any, {} as any, {} as any, {} as any);

      await expect(
        service.create(organizationId, callerId, { type: ConversationType.DIRECT, participantUserIds: [] }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(organizationId, callerId, {
          type: ConversationType.DIRECT,
          participantUserIds: [otherUserId, 'user-3'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('nem BadRequestException neu tu tao cuoc tro chuyen DIRECT voi chinh minh', async () => {
      const service = new ConversationsService({} as any, {} as any, {} as any, {} as any, {} as any);

      await expect(
        service.create(organizationId, callerId, { type: ConversationType.DIRECT, participantUserIds: [callerId] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create - GROUP', () => {
    it('nem BadRequestException neu thieu name (hoac name toan khoang trang)', async () => {
      const service = new ConversationsService({} as any, {} as any, {} as any, {} as any, {} as any);

      await expect(
        service.create(organizationId, callerId, { type: ConversationType.GROUP, participantUserIds: [otherUserId] }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(organizationId, callerId, {
          type: ConversationType.GROUP,
          participantUserIds: [otherUserId],
          name: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('tao nhom moi, tu dong them caller vao (khong trung neu caller tu liet ke chinh minh), phat conversation:new', async () => {
      const managerMock = {
        create: jest.fn().mockImplementation((_entity: unknown, data: unknown) => data),
        save: jest
          .fn()
          .mockImplementationOnce((data: any) => Promise.resolve({ id: 'group-1', ...data }))
          .mockImplementationOnce(() => Promise.resolve(undefined)),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const gatewayMock = { emitNewConversation: jest.fn() };
      const service = new ConversationsService(dataSourceMock as any, {} as any, {} as any, {} as any, gatewayMock as any);

      const result = await service.create(organizationId, callerId, {
        type: ConversationType.GROUP,
        name: 'Team A',
        participantUserIds: [callerId, otherUserId, 'user-3'],
      });

      expect(result.participantUserIds).toEqual([callerId, otherUserId, 'user-3']);
      expect(gatewayMock.emitNewConversation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'group-1' }),
        [callerId, otherUserId, 'user-3'],
      );
    });
  });

  describe('findAllForUser - unreadCount + lastMessage', () => {
    it('tinh unreadCount tu Message.count() va gan lastMessage tu tin nhan gan nhat chua bi xoa mem', async () => {
      const participantsServiceMock = {
        listByUserId: jest.fn().mockResolvedValue([{ conversationId: 'conv-1', lastReadAt: new Date('2024-01-01') }]),
        listByConversationIds: jest
          .fn()
          .mockResolvedValue([
            { conversationId: 'conv-1', userId: callerId },
            { conversationId: 'conv-1', userId: otherUserId },
          ]),
      };
      const conversationRepoMock = {
        find: jest
          .fn()
          .mockResolvedValue([
            { id: 'conv-1', organizationId, type: ConversationType.GROUP, name: 'Team', createdAt: new Date('2023-01-01') },
          ]),
      };
      const messageRepoMock = {
        findOne: jest.fn().mockResolvedValue({ body: 'hello', senderId: otherUserId, createdAt: new Date('2024-02-01') }),
        count: jest.fn().mockResolvedValue(3),
      };
      const service = new ConversationsService(
        {} as any,
        conversationRepoMock as any,
        messageRepoMock as any,
        participantsServiceMock as any,
        {} as any,
      );

      const result = await service.findAllForUser(organizationId, callerId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'conv-1',
        unreadCount: 3,
        lastMessage: { body: 'hello', senderId: otherUserId, createdAt: new Date('2024-02-01') },
        participantUserIds: [callerId, otherUserId],
      });
    });

    it('tra ve mang rong neu caller khong tham gia cuoc tro chuyen nao (khong truy van them)', async () => {
      const participantsServiceMock = { listByUserId: jest.fn().mockResolvedValue([]) };
      const service = new ConversationsService({} as any, {} as any, {} as any, participantsServiceMock as any, {} as any);

      const result = await service.findAllForUser(organizationId, callerId);

      expect(result).toEqual([]);
    });
  });

  describe('markRead', () => {
    it('403 (ForbiddenException tu ParticipantsService.assertParticipant) neu caller khong phai thanh vien', async () => {
      const conversationRepoMock = { findOne: jest.fn().mockResolvedValue({ id: 'conv-1', organizationId }) };
      const participantsServiceMock = {
        assertParticipant: jest.fn().mockRejectedValue(new ForbiddenException()),
        markRead: jest.fn(),
      };
      const service = new ConversationsService({} as any, conversationRepoMock as any, {} as any, participantsServiceMock as any, {} as any);

      await expect(service.markRead(organizationId, 'conv-1', callerId)).rejects.toThrow(ForbiddenException);
      expect(participantsServiceMock.markRead).not.toHaveBeenCalled();
    });
  });

  describe('updateParticipants - dieu kien uy quyen OR (createdBy HOAC MESSAGE_MANAGE_GROUP)', () => {
    it('400 neu cuoc tro chuyen la DIRECT (khong ho tro quan ly thanh vien)', async () => {
      const conversationRepoMock = {
        findOne: jest.fn().mockResolvedValue({ id: 'conv-1', organizationId, type: ConversationType.DIRECT, createdBy: callerId }),
      };
      const service = new ConversationsService({} as any, conversationRepoMock as any, {} as any, {} as any, {} as any);

      await expect(
        service.updateParticipants(organizationId, 'conv-1', callerId, [], { addUserIds: ['user-3'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('403 neu caller KHONG PHAI nguoi tao nhom VA KHONG giu MESSAGE_MANAGE_GROUP', async () => {
      const conversationRepoMock = {
        findOne: jest.fn().mockResolvedValue({ id: 'conv-1', organizationId, type: ConversationType.GROUP, createdBy: otherUserId }),
      };
      const service = new ConversationsService({} as any, conversationRepoMock as any, {} as any, {} as any, {} as any);

      await expect(
        service.updateParticipants(organizationId, 'conv-1', callerId, [], { addUserIds: ['user-3'] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('CHO PHEP neu caller la nguoi tao nhom, DU KHONG giu MESSAGE_MANAGE_GROUP', async () => {
      const conversation = { id: 'conv-1', organizationId, type: ConversationType.GROUP, createdBy: callerId, name: 'Team' };
      const conversationRepoMock = { findOne: jest.fn().mockResolvedValue(conversation) };
      const participantsServiceMock = {
        addMany: jest.fn().mockResolvedValue(undefined),
        removeMany: jest.fn().mockResolvedValue(undefined),
        listUserIds: jest.fn().mockResolvedValue([callerId, 'user-3']),
      };
      const gatewayMock = { emitConversationUpdated: jest.fn() };
      const service = new ConversationsService(
        {} as any,
        conversationRepoMock as any,
        {} as any,
        participantsServiceMock as any,
        gatewayMock as any,
      );

      const result = await service.updateParticipants(organizationId, 'conv-1', callerId, [], { addUserIds: ['user-3'] });

      expect(participantsServiceMock.addMany).toHaveBeenCalledWith('conv-1', ['user-3']);
      expect(result.participantUserIds).toEqual([callerId, 'user-3']);
      expect(gatewayMock.emitConversationUpdated).toHaveBeenCalled();
    });

    it('CHO PHEP neu caller giu MESSAGE_MANAGE_GROUP, DU KHONG PHAI nguoi tao nhom', async () => {
      const conversation = { id: 'conv-1', organizationId, type: ConversationType.GROUP, createdBy: otherUserId, name: 'Team' };
      const conversationRepoMock = { findOne: jest.fn().mockResolvedValue(conversation) };
      const participantsServiceMock = {
        addMany: jest.fn().mockResolvedValue(undefined),
        removeMany: jest.fn().mockResolvedValue(undefined),
        listUserIds: jest.fn().mockResolvedValue([otherUserId]),
      };
      const gatewayMock = { emitConversationUpdated: jest.fn() };
      const service = new ConversationsService(
        {} as any,
        conversationRepoMock as any,
        {} as any,
        participantsServiceMock as any,
        gatewayMock as any,
      );

      const result = await service.updateParticipants(
        organizationId,
        'conv-1',
        callerId,
        [PERMISSIONS.MESSAGE_MANAGE_GROUP],
        { removeUserIds: ['user-4'] },
      );

      expect(participantsServiceMock.removeMany).toHaveBeenCalledWith('conv-1', ['user-4']);
      expect(result.participantUserIds).toEqual([otherUserId]);
      // "Anh huong" bao gom ca nguoi VUA BI XOA (de client go cuoc tro chuyen khoi danh sach cua ho).
      expect(gatewayMock.emitConversationUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'conv-1' }),
        expect.arrayContaining(['user-4', otherUserId]),
      );
    });
  });
});
