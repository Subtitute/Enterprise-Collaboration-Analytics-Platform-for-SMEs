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
   */
  async createFromEvent(organizationId: string, draft: NotificationDraft): Promise<NotificationDocument> {
    const created = await this.notificationModel.create({
      organizationId,
      userId: draft.userId,
      type: draft.type,
      title: draft.title,
      message: draft.message,
      payload: draft.payload,
    });

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
