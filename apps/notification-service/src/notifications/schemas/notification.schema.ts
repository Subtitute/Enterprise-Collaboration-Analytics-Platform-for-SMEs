import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

/**
 * Collection `notifications` (MongoDB) - Technical_Spec.md muc 3.5, muc 5.
 * Du lieu ban cau truc, ghi nhanh, tra cuu don gian theo (organizationId, userId) ->
 * dung MongoDB thay vi Postgres, minh hoa polyglot persistence (Technical_Spec.md muc 2).
 */
@Schema({ collection: 'notifications', timestamps: { createdAt: true, updatedAt: false } })
export class Notification {
  /**
   * eventId cua DomainEvent goc (Technical_Spec.md muc 4.3). Unique index (khai bao o duoi) de
   * chong trung khi OutboxPublisherJob phia producer publish lai cung 1 su kien sau khi worker
   * crash giua luc publish (gioi han da biet - Technical_Spec.md muc 4.1, muc 3.5).
   */
  @Prop({ required: true })
  eventId: string;

  @Prop({ required: true })
  organizationId: string;

  /** userId cua nguoi nhan thong bao. */
  @Prop({ required: true })
  userId: string;

  /** Khop voi 1 gia tri trong EVENT_TYPES cua @app/common-dto (vd: 'task.assigned'). */
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  /** Du lieu goc lien quan (taskId, fileId, ...) de frontend dieu huong khi click. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  payload: Record<string, unknown>;

  @Prop({ default: false })
  isRead: boolean;

  /** Duoc Mongoose tu dong gan qua option `timestamps` o tren. */
  createdAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Index chinh phuc vu truy van "danh sach thong bao cua 1 user, loc theo trang thai doc,
// sap xep moi nhat truoc" - Technical_Spec.md muc 5.
NotificationSchema.index({ organizationId: 1, userId: 1, isRead: 1, createdAt: -1 });

// Unique index chong trung theo eventId - Technical_Spec.md muc 3.5, muc 4.1.
NotificationSchema.index({ eventId: 1 }, { unique: true });
