import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';
import { DomainEvent, KAFKA_CONSUMER_GROUPS, KAFKA_TOPICS } from '@app/common-dto';
import { NotificationsService } from '../notifications/notifications.service';
import { buildNotificationFromEvent } from './event-notification-builder';

/**
 * Kafka CONSUMER cho Notification Service (khac IAM la producer) - Technical_Spec.md muc 3.5,
 * muc 4.2. Subscribe ca 3 topic (`iam.events`, `project-task.events`, `document.events`) bang
 * 1 consumer group `notification-service-group` (KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE).
 *
 * MAU THAM CHIEU: dua theo cau truc cua apps/iam-service/src/kafka/kafka-producer.service.ts,
 * cung quy uoc module/config nhung doi Producer -> Consumer.
 */
@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.kafka = new Kafka({
      clientId: 'notification-service',
      brokers: [this.configService.get<string>('kafka.broker')!],
      retry: { retries: 8 },
    });
    this.consumer = this.kafka.consumer({ groupId: KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE });

    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: Object.values(KAFKA_TOPICS),
      fromBeginning: false,
    });
    await this.consumer.run({
      eachMessage: (payload) => this.handleMessage(payload),
    });

    this.logger.log(
      `Da ket noi Kafka consumer (group=${KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE}), ` +
        `subscribe topics: ${Object.values(KAFKA_TOPICS).join(', ')}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.disconnect();
  }

  private async handleMessage({ topic, message }: EachMessagePayload): Promise<void> {
    if (!message.value) return;

    let event: DomainEvent;
    try {
      event = JSON.parse(message.value.toString()) as DomainEvent;
    } catch (err) {
      this.logger.warn(`Khong parse duoc message JSON tu topic ${topic}: ${(err as Error).message}`);
      return;
    }

    // 22/07/2026: bo sung kiem tra "envelope" ngay sau JSON.parse - Technical_Spec.md muc 14
    // ("loi payload khong hop le bi bo qua va chi log lai"). Truoc fix nay, 1 message JSON hop
    // le VE CU PHAP nhung THIEU truong bat buoc (vd eventId/organizationId rong do bug o
    // producer) se lot qua buoc parse, roi lam NotificationsService.createFromEvent() nem loi
    // (vd Mongoose ValidationError do thieu organizationId) - loi nay bi rethrow GIONG HET loi
    // ha tang tam thoi ben duoi, khien kafkajs redeliver MAI MAI cung 1 "poison pill" va wedge
    // ca partition. Log kem noi dung message goc de debug, roi BO QUA (khong throw).
    if (!isValidDomainEventEnvelope(event)) {
      this.logger.error(
        `Bo qua message KHONG HOP LE tu topic ${topic} (thieu truong bat buoc eventId/eventType/organizationId/payload): ${message.value.toString()}`,
      );
      return;
    }

    const draft = buildNotificationFromEvent(event);
    if (!draft) {
      this.logger.debug(`Bo qua eventType khong sinh thong bao: ${event.eventType} (topic=${topic})`);
      return;
    }

    try {
      await this.notificationsService.createFromEvent(event.organizationId, event.eventId, draft);
    } catch (err) {
      // Loi ghi Mongo la loi TAM THOI (vd Mongo down/timeout) - log o muc error VA rethrow de
      // kafkajs KHONG commit offset cho message nay; consumer group se retry (Technical_Spec.md
      // muc 14 - "Kafka consumer chua co DLQ", loi ha tang tam thoi duoc retry o muc consumer).
      // Khac voi loi parse JSON o tren (khong the retry thanh cong -> log warn + bo qua).
      this.logger.error(
        `Loi khi tao notification tu event ${event.eventId} (type=${event.eventType}): ${(err as Error).message}`,
      );
      throw err;
    }
  }
}

/**
 * 22/07/2026: kiem tra 1 message JSON da parse thanh cong co du 4 truong bat buoc cua
 * DomainEvent (packages/common-dto/src/events/event-envelope.ts) hay khong - eventId,
 * eventType, organizationId, payload. Dung "duck typing" (kiem tra kieu du lieu tung truong)
 * thay vi import class/schema tu common-dto de giu dung nguyen tac service nay chi phu thuoc
 * vao KIEU (type-only) cua @app/common-dto, khong phu thuoc runtime logic ngoai pham vi.
 */
function isValidDomainEventEnvelope(value: unknown): value is DomainEvent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.eventId === 'string' &&
    v.eventId.length > 0 &&
    typeof v.eventType === 'string' &&
    v.eventType.length > 0 &&
    typeof v.organizationId === 'string' &&
    v.organizationId.length > 0 &&
    typeof v.payload === 'object' &&
    v.payload !== null
  );
}
