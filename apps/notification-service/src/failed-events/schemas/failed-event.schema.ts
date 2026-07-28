import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DeadLetterErrorType } from '@app/common-dto';

export type FailedEventDocument = HydratedDocument<FailedEvent>;

/**
 * 28/07/2026: collection `failed_events` (MongoDB) - luu lai cac DeadLetterEnvelope nhan duoc tu
 * KAFKA_TOPICS.DLQ (Technical_Spec.md muc 14 - nang cap Dead Letter Queue), phuc vu man hinh
 * quan tri "Danh sach su kien loi" (GET /failed-events - xem ../failed-events.controller.ts).
 * Cac truong khop 1-1 voi DeadLetterEnvelope (packages/common-dto/src/events/dead-letter-envelope.ts).
 * eventId/eventType/organizationId KHONG bat buoc (required: false) vi co the null khi loi xay ra
 * TRUOC luc doc duoc cac truong nay tu message goc (vd MALFORMED_JSON, hoac 1 phan cua
 * INVALID_ENVELOPE).
 */
@Schema({ collection: 'failed_events', timestamps: true })
export class FailedEvent {
  @Prop({ type: String, required: false, default: null })
  eventId: string | null;

  @Prop({ type: String, required: false, default: null })
  eventType: string | null;

  @Prop({ type: String, required: false, default: null })
  organizationId: string | null;

  /** Ten service da phat hien loi va day message nay vao DLQ (vd 'notification-service'). */
  @Prop({ required: true })
  sourceService: string;

  /** Topic Kafka GOC chua message loi (vd 'project-task.events'), khac voi KAFKA_TOPICS.DLQ. */
  @Prop({ required: true })
  sourceTopic: string;

  @Prop({ required: true })
  errorType: DeadLetterErrorType;

  @Prop({ required: true })
  errorMessage: string;

  /** So lan da thu xu ly truoc khi bi day vao DLQ. */
  @Prop({ required: true })
  attempts: number;

  /** JSON.stringify cua message Kafka goc (hoac chuoi tho neu ban than no khong phai JSON hop le). */
  @Prop({ required: true })
  rawPayload: string;

  /** ISO-8601 UTC - thoi diem PHAT HIEN loi (khac voi createdAt - thoi diem ghi vao Mongo). */
  @Prop({ required: true })
  failedAt: Date;

  /** Duoc Mongoose tu dong gan qua option `timestamps: true` o tren. */
  createdAt?: Date;
  updatedAt?: Date;
}

export const FailedEventSchema = SchemaFactory.createForClass(FailedEvent);

// 28/07/2026: index phuc vu GET /failed-events - loc theo to chuc (moi Org Admin chi xem duoc
// loi cua CHINH to chuc minh) va sap xep moi nhat truoc (failedAt giam dan).
FailedEventSchema.index({ organizationId: 1 });
FailedEventSchema.index({ failedAt: -1 });
