import { Model } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationDocument } from './schemas/notification.schema';
import { NotificationsGateway } from '../realtime/notifications.gateway';
import { NotificationDraft } from './interfaces/notification-draft.interface';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

/**
 * Unit test cho NotificationsService - tap trung vao 2 diem review 21/07/2026:
 *  1. `createFromEvent` phai idempotent theo `eventId` (Technical_Spec.md muc 3.5, muc 4.1):
 *     Mongo bao loi trung khoa (code 11000) -> coi la no-op thanh cong, KHONG day WS lan 2.
 *  2. `findForUser` phai loc duoc theo `type` (GET /notifications?type=...), alongside `isRead`.
 */
describe('NotificationsService', () => {
  let service: NotificationsService;
  let modelMock: {
    create: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
    findOne: jest.Mock;
    updateMany: jest.Mock;
  };
  let gatewayMock: { emitNewNotification: jest.Mock; emitUnreadCount: jest.Mock };

  const draft: NotificationDraft = {
    userId: 'user-1',
    type: 'task.assigned',
    title: 'Bạn được giao công việc mới',
    message: 'Ban vua duoc giao 1 cong viec moi',
    payload: { taskId: 'task-1' },
  };

  beforeEach(() => {
    modelMock = {
      create: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      findOne: jest.fn(),
      updateMany: jest.fn(),
    };
    gatewayMock = {
      emitNewNotification: jest.fn(),
      emitUnreadCount: jest.fn(),
    };

    service = new NotificationsService(
      modelMock as unknown as Model<NotificationDocument>,
      gatewayMock as unknown as NotificationsGateway,
    );
  });

  describe('createFromEvent', () => {
    it('tao notification moi (gan eventId) va day WS khi eventId chua ton tai', async () => {
      const created = { id: 'notif-1', ...draft };
      modelMock.create.mockResolvedValue(created);

      const result = await service.createFromEvent('org-1', 'evt-1', draft);

      expect(modelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt-1',
          organizationId: 'org-1',
          userId: 'user-1',
          type: 'task.assigned',
        }),
      );
      expect(gatewayMock.emitNewNotification).toHaveBeenCalledWith('user-1', created);
      expect(gatewayMock.emitUnreadCount).toHaveBeenCalledTimes(1);
      expect(result).toBe(created);
    });

    it('coi la no-op THANH CONG khi Mongo bao loi trung khoa eventId (code 11000) - khong day WS, khong rethrow', async () => {
      const duplicateKeyError = Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
      modelMock.create.mockRejectedValue(duplicateKeyError);

      const result = await service.createFromEvent('org-1', 'evt-1', draft);

      expect(result).toBeNull();
      expect(gatewayMock.emitNewNotification).not.toHaveBeenCalled();
      expect(gatewayMock.emitUnreadCount).not.toHaveBeenCalled();
    });

    it('rethrow loi Mongo KHAC (khong phai duplicate key) de Kafka consumer retry duoc', async () => {
      const transientError = new Error('Mongo connection timeout');
      modelMock.create.mockRejectedValue(transientError);

      await expect(service.createFromEvent('org-1', 'evt-1', draft)).rejects.toThrow(
        'Mongo connection timeout',
      );
      expect(gatewayMock.emitNewNotification).not.toHaveBeenCalled();
    });

    // 22/07/2026: bo sung - Fix 2 (poison-pill: loi du lieu vinh vien tu Mongoose bi log-and-skip).
    it('coi la no-op THANH CONG (khong rethrow) khi Mongoose bao ValidationError - khong day WS', async () => {
      const validationError = Object.assign(new Error('Path `userId` is required.'), {
        name: 'ValidationError',
      });
      modelMock.create.mockRejectedValue(validationError);

      const result = await service.createFromEvent('org-1', 'evt-1', draft);

      expect(result).toBeNull();
      expect(gatewayMock.emitNewNotification).not.toHaveBeenCalled();
      expect(gatewayMock.emitUnreadCount).not.toHaveBeenCalled();
    });

    it('coi la no-op THANH CONG (khong rethrow) khi Mongoose bao CastError - khong day WS', async () => {
      const castError = Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' });
      modelMock.create.mockRejectedValue(castError);

      const result = await service.createFromEvent('org-1', 'evt-1', draft);

      expect(result).toBeNull();
      expect(gatewayMock.emitNewNotification).not.toHaveBeenCalled();
    });
  });

  describe('findForUser', () => {
    function mockFindChain(data: unknown[]) {
      const execMock = jest.fn().mockResolvedValue(data);
      const limitMock = jest.fn().mockReturnValue({ exec: execMock });
      const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
      const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
      modelMock.find.mockReturnValue({ sort: sortMock });
      return { sortMock, skipMock, limitMock, execMock };
    }

    // 16/09/2026: cap nhat lai test theo dung hanh vi that cua findForUser() hien tai - service
    // xay `filter.type` thanh 1 RegExp khop TIEN TO (vd 'leave_request' khop ca
    // 'leave_request.approved'/'leave_request.rejected'), khong con so sanh chuoi tuyet doi nhu
    // truoc - test cu (mong doi `type: 'task.assigned'` dang chuoi) da loi thoi so voi code, phat
    // hien qua chay lai toan bo test suite sau khi merge nhanh frontend cua Tien.
    it('loc theo `type` khi query.type duoc truyen (GET /notifications?type=...)', async () => {
      mockFindChain([]);

      await service.findForUser('org-1', 'user-1', { page: 1, limit: 20, type: 'task.assigned' } as ListNotificationsQueryDto);

      expect(modelMock.find).toHaveBeenCalledWith({
        organizationId: 'org-1',
        userId: 'user-1',
        type: expect.any(RegExp),
      });
      const filterArg = modelMock.find.mock.calls[0][0] as { type: RegExp };
      expect(filterArg.type.test('task.assigned')).toBe(true);
      expect(filterArg.type.test('task.assigned.extra')).toBe(true);
      expect(filterArg.type.test('other.task.assigned')).toBe(false);
    });

    it('khong them dieu kien `type` vao filter khi query.type = undefined', async () => {
      mockFindChain([]);

      await service.findForUser('org-1', 'user-1', { page: 1, limit: 20 } as ListNotificationsQueryDto);

      expect(modelMock.find).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'user-1' });
    });

    // 16/09/2026: cung ly do cap nhat voi test "loc theo type" o tren - filter.type gio la RegExp
    // khop tien to, khong con la chuoi tuyet doi.
    it('ket hop dong thoi `type` va `isRead` trong filter', async () => {
      mockFindChain([]);

      await service.findForUser('org-1', 'user-1', {
        page: 1,
        limit: 20,
        type: 'document.shared',
        isRead: false,
      } as ListNotificationsQueryDto);

      expect(modelMock.find).toHaveBeenCalledWith({
        organizationId: 'org-1',
        userId: 'user-1',
        isRead: false,
        type: expect.any(RegExp),
      });
      const filterArg = modelMock.find.mock.calls[0][0] as { type: RegExp };
      expect(filterArg.type.test('document.shared')).toBe(true);
    });
  });

  // 29/08/2026: bo sung - markAsRead()/markAllAsRead() chua tung co test nao (0% branch coverage),
  // la 1 trong nhung nguyen nhan chinh khien coverageThreshold "branches" (55%) cua
  // notification-service khong dat (thuc te 49.57%), lam that bai buoc "Unit tests" tren CI
  // (Technical_Spec.md muc 11) du moi assertion hien co van pass.
  describe('markAsRead', () => {
    const validId = '507f1f77bcf86cd799439011';

    it('nem NotFoundException neu id truyen vao khong phai ObjectId hop le', async () => {
      await expect(service.markAsRead('org-1', 'user-1', 'not-a-valid-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(modelMock.findOne).not.toHaveBeenCalled();
    });

    it('nem NotFoundException neu khong tim thay notification thuoc dung organization/user', async () => {
      modelMock.findOne.mockResolvedValue(null);

      await expect(service.markAsRead('org-1', 'user-1', validId)).rejects.toThrow(NotFoundException);
      expect(modelMock.findOne).toHaveBeenCalledWith({ _id: validId, organizationId: 'org-1', userId: 'user-1' });
    });

    it('khong goi save()/emitUnreadCount neu notification DA doc san (no-op)', async () => {
      const notificationMock = { isRead: true, save: jest.fn() };
      modelMock.findOne.mockResolvedValue(notificationMock);

      const result = await service.markAsRead('org-1', 'user-1', validId);

      expect(notificationMock.save).not.toHaveBeenCalled();
      expect(gatewayMock.emitUnreadCount).not.toHaveBeenCalled();
      expect(result).toBe(notificationMock);
    });

    it('danh dau da doc, luu lai va day emitUnreadCount khi notification dang CHUA doc', async () => {
      const notificationMock = { isRead: false, save: jest.fn().mockResolvedValue(undefined) };
      modelMock.findOne.mockResolvedValue(notificationMock);
      modelMock.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(3) });

      const result = await service.markAsRead('org-1', 'user-1', validId);

      expect(notificationMock.isRead).toBe(true);
      expect(notificationMock.save).toHaveBeenCalledTimes(1);
      expect(gatewayMock.emitUnreadCount).toHaveBeenCalledWith('user-1', 3);
      expect(result).toBe(notificationMock);
    });
  });

  describe('markAllAsRead', () => {
    it('danh dau tat ca notification chua doc thanh da doc va day emitUnreadCount(0)', async () => {
      modelMock.updateMany.mockResolvedValue({ modifiedCount: 5 });

      const result = await service.markAllAsRead('org-1', 'user-1');

      expect(modelMock.updateMany).toHaveBeenCalledWith(
        { organizationId: 'org-1', userId: 'user-1', isRead: false },
        { $set: { isRead: true } },
      );
      expect(gatewayMock.emitUnreadCount).toHaveBeenCalledWith('user-1', 0);
      expect(result).toEqual({ modifiedCount: 5 });
    });
  });
});
