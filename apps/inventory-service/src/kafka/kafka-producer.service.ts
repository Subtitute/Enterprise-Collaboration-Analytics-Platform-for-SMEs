import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { DomainEvent } from '@app/common-dto';

/**
 * Wrapper mong quanh kafkajs producer.
 * Sao chep tu apps/iam-service/src/kafka/kafka-producer.service.ts (file mau tham chieu),
 * chi doi `clientId`.
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka;
  private producer: Producer;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.kafka = new Kafka({
      clientId: 'inventory-service',
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
