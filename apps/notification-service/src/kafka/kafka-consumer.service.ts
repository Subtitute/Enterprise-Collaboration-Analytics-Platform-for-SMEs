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

    const draft = buildNotificationFromEvent(event);
    if (!draft) {
      this.logger.debug(`Bo qua eventType khong sinh thong bao: ${event.eventType} (topic=${topic})`);
      return;
    }

    try {
      await this.notificationsService.createFromEvent(event.organizationId, draft);
    } catch (err) {
      this.logger.error(
        `Loi khi tao notification tu event ${event.eventId} (type=${event.eventType}): ${(err as Error).message}`,
      );
    }
  }
}
