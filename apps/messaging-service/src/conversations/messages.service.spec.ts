import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';

/**
 * Unit test cho MessagesService - mock thu cong Repository/ParticipantsService/MessagingGateway.
 * Tap trung vao: 403 khi khong phai thanh vien (listMessages/sendMessage), 404 khi cuoc tro chuyen
 * khong thuoc dung to chuc, thu tu tra ve TANG DAN cua listMessages (dao nguoc ket qua DESC tu DB),
 * va quyen xoa mem tin nhan CHI danh cho chinh nguoi gui.
 */
describe('MessagesService', () => {
  const organizationId = 'org-1';
  const conversationId = 'conv-1';
  const callerId = 'user-1';

  function makeMessageQueryBuilder(result: unknown[]) {
    const qb: any = {};
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.orderBy = jest.fn().mockReturnValue(qb);
    qb.take = jest.fn().mockReturnValue(qb);
    qb.getMany = jest.fn().mockResolvedValue(result);
    return qb;
  }

  describe('listMessages', () => {
    it('404 neu cuoc tro chuyen khong thuoc dung to chuc cua caller', async () => {
      const conversationRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const service = new MessagesService(conversationRepoMock as any, {} as any, {} as any, {} as any);

      await expect(service.listMessages(organizationId, conversationId, callerId, 50)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('403 neu caller khong phai thanh vien cuoc tro chuyen', async () => {
      const conversationRepoMock = { findOne: jest.fn().mockResolvedValue({ id: conversationId, organizationId }) };
      const participantsServiceMock = { assertParticipant: jest.fn().mockRejectedValue(new ForbiddenException()) };
      const service = new MessagesService(conversationRepoMock as any, {} as any, participantsServiceMock as any, {} as any);

      await expect(service.listMessages(organizationId, conversationId, callerId, 50)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('tra ve tin nhan theo thu tu TANG DAN theo createdAt (DB tra ve DESC, service dao lai)', async () => {
      const conversationRepoMock = { findOne: jest.fn().mockResolvedValue({ id: conversationId, organizationId }) };
      const participantsServiceMock = { assertParticipant: jest.fn().mockResolvedValue({}) };
      const oldest = { id: 'm1', body: 'first', createdAt: new Date('2024-01-01') };
      const newest = { id: 'm2', body: 'second', createdAt: new Date('2024-01-02') };
      // DB tra ve DESC (moi nhat truoc) - service phai dao lai thanh ASC truoc khi tra ve.
      const qb = makeMessageQueryBuilder([newest, oldest]);
      const messageRepoMock = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
      const service = new MessagesService(conversationRepoMock as any, messageRepoMock as any, participantsServiceMock as any, {} as any);

      const result = await service.listMessages(organizationId, conversationId, callerId, 50);

      expect(result).toEqual([oldest, newest]);
    });

    it('ap dung cursor beforeMessageId (chi loc them neu tim thay tin nhan lam moc)', async () => {
      const conversationRepoMock = { findOne: jest.fn().mockResolvedValue({ id: conversationId, organizationId }) };
      const participantsServiceMock = { assertParticipant: jest.fn().mockResolvedValue({}) };
      const qb = makeMessageQueryBuilder([]);
      const cursorMessage = { id: 'cursor-msg', createdAt: new Date('2024-01-05') };
      const messageRepoMock = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        findOne: jest.fn().mockResolvedValue(cursorMessage),
      };
      const service = new MessagesService(conversationRepoMock as any, messageRepoMock as any, participantsServiceMock as any, {} as any);

      await service.listMessages(organizationId, conversationId, callerId, 50, 'cursor-msg');

      expect(qb.andWhere).toHaveBeenCalledWith('message.createdAt < :cursorCreatedAt', {
        cursorCreatedAt: cursorMessage.createdAt,
      });
    });
  });

  describe('sendMessage', () => {
    it('403 neu caller khong phai thanh vien cuoc tro chuyen', async () => {
      const conversationRepoMock = { findOne: jest.fn().mockResolvedValue({ id: conversationId, organizationId }) };
      const participantsServiceMock = { assertParticipant: jest.fn().mockRejectedValue(new ForbiddenException()) };
      const service = new MessagesService(conversationRepoMock as any, {} as any, participantsServiceMock as any, {} as any);

      await expect(service.sendMessage(organizationId, conversationId, callerId, { body: 'hi' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('luu tin nhan roi phat message:new toi TAT CA thanh vien qua Gateway', async () => {
      const conversationRepoMock = { findOne: jest.fn().mockResolvedValue({ id: conversationId, organizationId }) };
      const savedMessage = { id: 'msg-1', conversationId, senderId: callerId, body: 'hi' };
      const messageRepoMock = {
        create: jest.fn().mockImplementation((data: unknown) => data),
        save: jest.fn().mockResolvedValue(savedMessage),
      };
      const participantsServiceMock = {
        assertParticipant: jest.fn().mockResolvedValue({}),
        listUserIds: jest.fn().mockResolvedValue([callerId, 'user-2']),
      };
      const gatewayMock = { emitNewMessage: jest.fn() };
      const service = new MessagesService(conversationRepoMock as any, messageRepoMock as any, participantsServiceMock as any, gatewayMock as any);

      const result = await service.sendMessage(organizationId, conversationId, callerId, { body: 'hi' });

      expect(result).toBe(savedMessage);
      expect(gatewayMock.emitNewMessage).toHaveBeenCalledWith(conversationId, savedMessage, [callerId, 'user-2']);
    });
  });

  describe('deleteMessage', () => {
    it('404 neu tin nhan khong ton tai (hoac da bi xoa mem truoc do)', async () => {
      const messageRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const service = new MessagesService({} as any, messageRepoMock as any, {} as any, {} as any);

      await expect(service.deleteMessage(conversationId, 'msg-1', callerId)).rejects.toThrow(NotFoundException);
    });

    it('403 neu caller KHONG PHAI nguoi gui tin nhan', async () => {
      const message = { id: 'msg-1', conversationId, senderId: 'other-user', deletedAt: null };
      const messageRepoMock = { findOne: jest.fn().mockResolvedValue(message) };
      const service = new MessagesService({} as any, messageRepoMock as any, {} as any, {} as any);

      await expect(service.deleteMessage(conversationId, 'msg-1', callerId)).rejects.toThrow(ForbiddenException);
    });

    it('xoa mem (gan deletedAt) khi caller la chinh nguoi gui', async () => {
      const message = { id: 'msg-1', conversationId, senderId: callerId, deletedAt: null };
      const messageRepoMock = {
        findOne: jest.fn().mockResolvedValue(message),
        save: jest.fn().mockImplementation((m: unknown) => Promise.resolve(m)),
      };
      const service = new MessagesService({} as any, messageRepoMock as any, {} as any, {} as any);

      await service.deleteMessage(conversationId, 'msg-1', callerId);

      expect(messageRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(Date) }));
    });
  });
});
