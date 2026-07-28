import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';

/**
 * Wrapper mong quanh kafkajs producer.
 * MAU THAM CHIEU: cac service khac copy file nay, chi doi `clientId`.
 *
 * 28/07/2026: clone tu apps/iam-service/src/kafka/kafka-producer.service.ts de Analytics Service
 * co the TU PHAT message (truoc day service nay CHI la consumer) vao KAFKA_TOPICS.DLQ khi
 * KafkaConsumerService xu ly 1 trong 4 nhanh loi vinh vien/het luot retry (xem
 * kafka-consumer.service.ts, Technical_Spec.md muc 14 "Kafka consumer chua co DLQ"). Tham so thu
 * 2 cua publish() noi long thanh Record<string, unknown> (ban goc dung DomainEvent) vi noi dung
 * DUY NHAT ma service nay publish la DeadLetterEnvelope - khac shape voi DomainEvent (vd khong co
 * truong `producer`/`occurredAt`), nen giu nguyen kieu DomainEvent se khong khop.
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka;
  private producer: Producer;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.kafka = new Kafka({
      clientId: 'analytics-service', // 28/07/2026: dinh danh rieng cho analytics-service (ban goc iam-service dung 'iam-service')
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

  // 28/07/2026: tham so `event` noi long thanh Record<string, unknown> (thay vi DomainEvent nhu
  // ban goc iam-service) - xem ghi chu dau file. `key` lay organizationId neu co (string), nguoc
  // lai dung null (vd DeadLetterEnvelope cua loi MALFORMED_JSON/INVALID_ENVELOPE co the chua doc
  // duoc organizationId that tu message goc).
  async publish(topic: string, event: Record<string, unknown>): Promise<void> {
    const key = typeof event.organizationId === 'string' ? event.organizationId : null;
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(event) }],
    });
  }
}
