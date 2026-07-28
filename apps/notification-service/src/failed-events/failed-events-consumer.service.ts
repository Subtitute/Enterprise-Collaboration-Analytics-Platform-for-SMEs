import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';
import { DeadLetterEnvelope, KAFKA_CONSUMER_GROUPS, KAFKA_TOPICS } from '@app/common-dto';
import { FailedEventsService } from './failed-events.service';

/**
 * 28/07/2026: consumer RIENG (Kafka instance/group RIENG voi KafkaConsumerService o
 * ../kafka/kafka-consumer.service.ts) - CHI subscribe KAFKA_TOPICS.DLQ, dung group
 * KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE_DLQ, de luu lai TOAN BO lich su message loi
 * (Technical_Spec.md muc 14 - nang cap Dead Letter Queue) phuc vu man hinh quan tri
 * GET /failed-events (xem failed-events.controller.ts). Tach rieng consumer/group voi consumer
 * domain-event chinh de 2 luong xu ly (DomainEvent goc vs DeadLetterEnvelope) khong tranh nhau
 * partition/offset cua nhau - xem chi tiet trong ghi chu tai kafka-consumer.service.ts.
 */
@Injectable()
export class FailedEventsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FailedEventsConsumerService.name);
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly failedEventsService: FailedEventsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.kafka = new Kafka({
      clientId: 'notification-service-dlq-consumer',
      brokers: [this.configService.get<string>('kafka.broker')!],
      retry: { retries: 8 },
    });
    this.consumer = this.kafka.consumer({ groupId: KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE_DLQ });

    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [KAFKA_TOPICS.DLQ],
      // 28/07/2026: fromBeginning=true (giong analytics-service/src/kafka/kafka-consumer.service.ts
      // doi voi 3 topic domain event cua no) - man hinh quan tri GET /failed-events can backfill
      // lai TOAN BO lich su loi tu truoc khi consumer nay lan dau khoi dong, khong chi cac loi
      // phat sinh SAU do.
      fromBeginning: true,
    });
    await this.consumer.run({
      eachMessage: (payload) => this.handleMessage(payload),
    });

    this.logger.log(
      `Da ket noi Kafka DLQ consumer (group=${KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE_DLQ}), subscribe topic: ${KAFKA_TOPICS.DLQ}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.disconnect();
  }

  private async handleMessage({ message }: EachMessagePayload): Promise<void> {
    if (!message.value) return;

    let envelope: DeadLetterEnvelope;
    try {
      envelope = JSON.parse(message.value.toString()) as DeadLetterEnvelope;
    } catch (err) {
      // 28/07/2026: phong thu - ban than topic DLQ nhan duoc message KHONG PHAI JSON hop le la
      // rat hiem (chi cac service noi bo goi KafkaProducerService.publish() tu publishToDlq() moi
      // ghi vao topic nay), nhung KHONG duoc gia dinh dieu do khong the xay ra - log + bo qua
      // (khong throw) de khong lam crash/wedge chinh consumer dang co nhiem vu ghi lai lich su loi.
      this.logger.error(
        `Bo qua message KHONG PHAI JSON hop le tren chinh topic DLQ (${KAFKA_TOPICS.DLQ}): ${(err as Error).message}`,
      );
      return;
    }

    await this.failedEventsService.record(envelope);
  }
}
