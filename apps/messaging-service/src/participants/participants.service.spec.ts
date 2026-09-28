import { ForbiddenException } from '@nestjs/common';
import { ParticipantsService } from './participants.service';

/**
 * Unit test cho ParticipantsService - mock thu cong Repository (khong boot NestJS module hay DB
 * that), mirror apps/crm-service/src/customers/customers.service.spec.ts. Tap trung vao 403 khi
 * khong phai thanh vien (assertParticipant) va hanh vi idempotent cua addMany().
 */
describe('ParticipantsService', () => {
  const conversationId = 'conv-1';
  const userId = 'user-1';

  describe('assertParticipant', () => {
    it('nem ForbiddenException neu userId khong phai thanh vien cuoc tro chuyen', async () => {
      const repoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const service = new ParticipantsService(repoMock as any);

      await expect(service.assertParticipant(conversationId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('tra ve ban ghi participant neu la thanh vien', async () => {
      const participant = { conversationId, userId, lastReadAt: null };
      const repoMock = { findOne: jest.fn().mockResolvedValue(participant) };
      const service = new ParticipantsService(repoMock as any);

      await expect(service.assertParticipant(conversationId, userId)).resolves.toBe(participant);
    });
  });

  describe('isParticipant', () => {
    it('tra ve false (khong nem loi) neu khong phai thanh vien - dung cho Gateway.joinConversation', async () => {
      const repoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const service = new ParticipantsService(repoMock as any);

      await expect(service.isParticipant(conversationId, userId)).resolves.toBe(false);
    });
  });

  describe('addMany', () => {
    it('bo qua userId da la thanh vien san (idempotent), chi save() cho userId moi', async () => {
      const repoMock = {
        findOne: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(where.userId === 'existing-user' ? { conversationId, userId: 'existing-user' } : null),
        ),
        create: jest.fn().mockImplementation((data: unknown) => data),
        save: jest.fn().mockResolvedValue(undefined),
      };
      const service = new ParticipantsService(repoMock as any);

      await service.addMany(conversationId, ['existing-user', 'new-user']);

      expect(repoMock.save).toHaveBeenCalledTimes(1);
      expect(repoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId, userId: 'new-user' }),
      );
    });
  });

  describe('removeMany', () => {
    it('khong goi delete() neu danh sach rong', async () => {
      const repoMock = { delete: jest.fn() };
      const service = new ParticipantsService(repoMock as any);

      await service.removeMany(conversationId, []);

      expect(repoMock.delete).not.toHaveBeenCalled();
    });
  });
});
