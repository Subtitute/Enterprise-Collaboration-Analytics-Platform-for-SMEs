import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { DeadLetterEnvelope, PaginatedResponse, paginate } from '@app/common-dto';
import { FailedEvent, FailedEventDocument } from './schemas/failed-event.schema';
import { ListFailedEventsQueryDto } from './dto/list-failed-events-query.dto';

/**
 * 28/07/2026: service cho man hinh quan tri "Danh sach su kien loi" (Technical_Spec.md muc 14 -
 * nang cap Dead Letter Queue). MAU THAM CHIEU: notifications/notifications.service.ts (cung
 * Mongoose + quy uoc phan trang paginate() cua @app/common-dto).
 */
@Injectable()
export class FailedEventsService {
  private readonly logger = new Logger(FailedEventsService.name);

  constructor(
    @InjectModel(FailedEvent.name) private readonly failedEventModel: Model<FailedEventDocument>,
  ) {}

  /**
   * Ghi 1 DeadLetterEnvelope (nhan tu KAFKA_TOPICS.DLQ) vao Mongo. KHONG can co che chong trung
   * phuc tap (vd unique index theo eventId nhu Notification.eventId) - day la du lieu CHAN DOAN
   * loi (diagnostic), khong phai du lieu nghiep vu; 1 vai ban ghi trung do Kafka redeliver hiem
   * gap (vd FailedEventsConsumerService restart giua chung, truoc khi kafkajs commit offset) la
   * danh doi chap nhan duoc, khong dang de them do phuc tap idempotency o day.
   */
  async record(envelope: DeadLetterEnvelope): Promise<void> {
    await this.failedEventModel.create({ ...envelope });
    this.logger.debug(
      `Da luu 1 failed event (errorType=${envelope.errorType}, sourceTopic=${envelope.sourceTopic}, eventId=${envelope.eventId ?? 'null'})`,
    );
  }

  /** Danh sach loi cua 1 to chuc, phan trang, moi nhat truoc - dung cho GET /failed-events. */
  async findForOrganization(
    organizationId: string,
    query: ListFailedEventsQueryDto,
  ): Promise<PaginatedResponse<FailedEventDocument>> {
    const filter: FilterQuery<FailedEventDocument> = { organizationId };

    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      this.failedEventModel
        .find(filter)
        .sort({ failedAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .exec(),
      this.failedEventModel.countDocuments(filter).exec(),
    ]);

    return paginate(data, total, query.page, query.limit);
  }
}
