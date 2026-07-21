import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResponse, paginate } from '@app/common-dto';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsGateway } from '../realtime/notifications.gateway';
import { NotificationDraft } from './interfaces/notification-draft.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Tao 1 notification tu 1 draft (da duoc suy ra boi event-notification-builder) va day
   * real-time toi client qua WebSocket (notification:new + notification:unread-count).
   *
   * Idempotent theo `eventId` (Technical_Spec.md muc 3.5, muc 4.1): OutboxPublisherJob phia
   * producer co the publish trung 1 su kien neu worker crash giua luc publish. Neu Mongo bao
   * loi trung khoa (`code === 11000`, vi pham unique index tren `eventId`), coi day la 1
   * no-op thanh cong - KHONG tao notification/day WS lan 2, KHONG rethrow.
   */
  async createFromEvent(
    organizationId: string,
    eventId: string,
    draft: NotificationDraft,
  ): Promise<NotificationDocument | null> {
    let created: NotificationDocument;
    try {
      created = await this.notificationModel.create({
        eventId,
        organizationId,
        userId: draft.userId,
        type: draft.type,
        title: draft.title,
        message: draft.message,
        payload: draft.payload,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        this.logger.debug(
          `Bo qua notification trung (eventId=${eventId}) - Outbox co the da publish lai cung 1 su kien.`,
        );
        return null;
      }
      throw err;
    }

    this.gateway.emitNewNotification(draft.userId, created);
    const unreadCount = await this.countUnread(organizationId, draft.userId);
    this.gateway.emitUnreadCount(draft.userId, unreadCount);

    this.logger.debug(`Da tao notification ${created.id} cho user ${draft.userId} (type=${draft.type})`);
    return created;
  }

  async findForUser(
    organizationId: string,
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<PaginatedResponse<NotificationDocument>> {
    const filter: FilterQuery<NotificationDocument> = { organizationId, userId };
    if (query.isRead !== undefined) {
      filter.isRead = query.isRead;
    }
    if (query.type !== undefined) {
      filter.type = query.type;
    }

    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async markAsRead(organizationId: string, userId: string, id: string): Promise<NotificationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Khong tim thay thong bao');
    }

    const notification = await this.notificationModel.findOne({ _id: id, organizationId, userId });
    if (!notification) {
      throw new NotFoundException('Khong tim thay thong bao');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
      const unreadCount = await this.countUnread(organizationId, userId);
      this.gateway.emitUnreadCount(userId, unreadCount);
    }

    return notification;
  }

  async markAllAsRead(organizationId: string, userId: string): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel.updateMany(
      { organizationId, userId, isRead: false },
      { $set: { isRead: true } },
    );

    this.gateway.emitUnreadCount(userId, 0);
    return { modifiedCount: result.modifiedCount };
  }

  private countUnread(organizationId: string, userId: string): Promise<number> {
    return this.notificationModel.countDocuments({ organizationId, userId, isRead: false }).exec();
  }
}

/** Mongo/MongoDB driver bao loi trung khoa (unique index vi pham) qua ma loi `11000`. */
function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}
