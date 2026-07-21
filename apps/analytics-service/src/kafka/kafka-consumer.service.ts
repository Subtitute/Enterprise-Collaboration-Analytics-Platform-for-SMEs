import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka } from 'kafkajs';
import { DomainEvent, KAFKA_CONSUMER_GROUPS, KAFKA_TOPICS } from '@app/common-dto';
import { FactWriterService } from '../analytics/fact-writer.service';
import { AnalyticsGateway } from '../realtime/analytics.gateway';

/**
 * Consumer duy nhat cua Analytics Service - lang nghe ca 3 topic (iam/project-task/document)
 * bang 1 consumer group `analytics-service-group` (Technical_Spec.md muc 4.2, muc 3.6).
 *
 * Moi message deu duoc ghi vao fact_user_activity (idempotent theo eventId - xem
 * FactWriterService), sau do tuy eventType ma ghi bo sung vao fact_task_events hoac
 * fact_document_events, roi day cap nhat real-time qua AnalyticsGateway.
 *
 * QUAN TRONG (Technical_Spec.md muc 4.1 - gioi han da biet): OutboxPublisherJob phia producer
 * co the phat trung 1 event neu crash giua luc publish -> service nay PHAI dung idempotent
 * (ON CONFLICT DO NOTHING theo eventId), KHONG duoc gia dinh Kafka giao dung 1 lan.
 */
@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly factWriter: FactWriterService,
    private readonly gateway: AnalyticsGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    this.kafka = new Kafka({
      clientId: 'analytics-service',
      brokers: [this.configService.get<string>('kafka.broker')!],
      retry: { retries: 8 },
    });
    this.consumer = this.kafka.consumer({ groupId: KAFKA_CONSUMER_GROUPS.ANALYTICS_SERVICE });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [KAFKA_TOPICS.IAM, KAFKA_TOPICS.PROJECT_TASK, KAFKA_TOPICS.DOCUMENT],
      // fromBeginning: dashboard/KPI can tong hop lai TOAN BO lich su su kien tu khi trien khai,
      // khong chi su kien phat sinh sau khi Analytics Service khoi dong lan dau.
      fromBeginning: true,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        let event: DomainEvent;
        try {
          event = JSON.parse(message.value.toString()) as DomainEvent;
        } catch (error) {
          // Loi KHONG THE PHUC HOI (malformed JSON) - retry cung message se luon that bai giong
          // nhau, nen log o muc warn va BO QUA (khong rethrow) de kafkajs commit offset va
          // chuyen sang message tiep theo. Khac voi loi ghi TimescaleDB o handleEvent() ben duoi.
          this.logger.warn(`Khong parse duoc message JSON tu topic ${topic}: ${(error as Error).message}`);
          return;
        }
        await this.handleEvent(event);
      },
    });

    this.logger.log(
      `Da ket noi Kafka consumer (group=${KAFKA_CONSUMER_GROUPS.ANALYTICS_SERVICE}, topics=${KAFKA_TOPICS.IAM},${KAFKA_TOPICS.PROJECT_TASK},${KAFKA_TOPICS.DOCUMENT})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.disconnect();
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    try {
      // 1. Luon ghi vao fact_user_activity - phuc vu feed "Hoat dong gan day" (moi event).
      await this.factWriter.recordUserActivity(event);

      // 2. Ghi bo sung theo loai su kien.
      if (event.eventType.startsWith('task.') || event.eventType.startsWith('project.')) {
        await this.factWriter.recordTaskEvent(event);
      } else if (event.eventType.startsWith('document.')) {
        await this.factWriter.recordDocumentEvent(event);
      }

      // 3. Day cap nhat real-time cho Dashboard cua dung to chuc.
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const actorId = typeof payload.actorId === 'string' ? payload.actorId : null;
      this.gateway.emitActivity(event.organizationId, {
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        actorId,
      });
    } catch (error) {
      // Loi TAM THOI (vd TimescaleDB down/timeout khi FactWriterService.* goi DataSource.query)
      // - log o muc error VA rethrow de kafkajs KHONG commit offset cho message nay; consumer
      // group se retry (Technical_Spec.md muc 14 - "Kafka consumer chua co DLQ"). Khac voi loi
      // parse JSON o eachMessage() (khong the retry thanh cong -> log warn + bo qua, xem tren).
      this.logger.error(
        `Loi khi xu ly event ${event.eventType} (eventId=${event.eventId})`,
        error as Error,
      );
      throw error;
    }
  }
}
