import { Model } from 'mongoose';
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

    it('loc theo `type` khi query.type duoc truyen (GET /notifications?type=...)', async () => {
      mockFindChain([]);

      await service.findForUser('org-1', 'user-1', { page: 1, limit: 20, type: 'task.assigned' } as ListNotificationsQueryDto);

      expect(modelMock.find).toHaveBeenCalledWith({
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'task.assigned',
      });
    });

    it('khong them dieu kien `type` vao filter khi query.type = undefined', async () => {
      mockFindChain([]);

      await service.findForUser('org-1', 'user-1', { page: 1, limit: 20 } as ListNotificationsQueryDto);

      expect(modelMock.find).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'user-1' });
    });

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
        type: 'document.shared',
      });
    });
  });
});
