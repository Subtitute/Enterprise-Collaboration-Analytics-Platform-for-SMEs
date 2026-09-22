import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

/**
 * Collection `notifications` (MongoDB) - Technical_Spec.md muc 3.5, muc 5.
 * Du lieu ban cau truc, ghi nhanh, tra cuu don gian theo (organizationId, userId) ->
 * dung MongoDB thay vi Postgres, minh hoa polyglot persistence (Technical_Spec.md muc 2).
 */
// 22/07/2026: bat `toJSON.virtuals` de response JSON co field `id` (string, tu virtual getter
// co san cua Mongoose tren `_id`) thay vi chi co `_id` (ObjectId) - Frontend (AppNotification.id)
// doc field `id`; thieu no khien PATCH /notifications/:id/read luon goi voi id="undefined" ->
// 404 ("Khong tim thay thong bao"), trong khi PATCH /notifications/read-all khong can id nen
// van hoat dong binh thuong (dung voi trieu chung: "mark all" duoc, "mark 1 cai" thi khong).
@Schema({
  collection: 'notifications',
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: { virtuals: true },
})
export class Notification {
  /**
   * eventId cua DomainEvent goc (Technical_Spec.md muc 4.3). Unique index HOP (eventId, userId,
   * khai bao o duoi) de chong trung khi OutboxPublisherJob phia producer publish lai cung 1 su
   * kien sau khi worker crash giua luc publish (gioi han da biet - Technical_Spec.md muc 4.1, muc
   * 3.5) - VAN cho phep NHIEU document cung eventId khi 1 su kien can THONG BAO CHO NHIEU NGUOI
   * (vd cong bo ngay nghi le toan to chuc, xem buildBroadcastNotificationTemplate() +
   * KafkaConsumerService.handleMessage()); truoc 17/09/2026 index nay la {eventId:1} DON, chi cho
   * phep DUY NHAT 1 document/eventId - khong dung duoc cho truong hop fan-out nhieu nguoi nhan.
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

// Unique index chong trung theo CAP (eventId, userId) - Technical_Spec.md muc 3.5, muc 4.1. Xem
// chu thich chi tiet tai field `eventId` o tren ve ly do doi tu {eventId:1} don sang hop (17/09/2026).
NotificationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
