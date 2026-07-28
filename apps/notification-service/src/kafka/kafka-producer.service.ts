import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { DomainEvent } from '@app/common-dto';

/**
 * 28/07/2026: clone tu apps/iam-service/src/kafka/kafka-producer.service.ts (file do tu nhan la
 * "MAU THAM CHIEU: cac service khac copy file nay, chi doi clientId") - notification-service can
 * 1 producer de tu day message loi vao KAFKA_TOPICS.DLQ (Technical_Spec.md muc 14 - nang cap Dead
 * Letter Queue), khac voi KafkaConsumerService (chi tieu thu) da co san cua service nay. CHI
 * khac ban goc o `clientId` ('notification-service' thay vi 'iam-service').
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka;
  private producer: Producer;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.kafka = new Kafka({
      clientId: 'notification-service',
      brokers: [this.configService.get<string>('kafka.broker')!],
      retry: { retries: 8 },
    });
    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.logger.log('Da ket noi Kafka producer');
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer?.disconnect();
  }

  async publish(topic: string, event: DomainEvent): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ key: event.organizationId, value: JSON.stringify(event) }],
    });
  }
}
