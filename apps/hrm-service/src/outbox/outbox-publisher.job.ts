import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { DomainEvent, EVENT_TYPE_TOPIC_MAP, EventType, KAFKA_TOPICS } from '@app/common-dto';

/**
 * Poll bang outbox_events moi 2.5s va publish len Kafka - Technical_Spec.md muc 4.1.
 * Gioi han da biet: do tre vai giay (khong phai CDC that su); publish co the trung lap
 * neu job crash giua chung -> consumer PHAI idempotent theo eventId (xem Analytics/Notification Service).
 * Sao chep tu apps/iam-service/src/outbox/outbox-publisher.job.ts (file mau tham chieu).
 */
@Injectable()
export class OutboxPublisherJob {
  private readonly logger = new Logger(OutboxPublisherJob.name);
  private isRunning = false;

  constructor(
    @InjectRepository(OutboxEvent) private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  @Interval(2500)
  async publishPendingEvents(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const pending = await this.outboxRepo.find({
        where: { published: false },
        order: { createdAt: 'ASC' },
        take: 50,
      });

      // 25/08/2026: fix code review CRITICAL - truoc day 1 record loi phi-tam-thoi (payload sai,
      // message qua khuon kho, sai topic) se lam throw ca vong lap for, khien record do nam ket
      // o dau hang doi (query khong scope theo to chuc, sap ASC theo createdAt) va chan Kafka cho
      // TAT CA to chuc moi tick. Boc try/catch tung record: loi thi log va continue sang record
      // ke tiep, khong revert published (van la false) de tick sau tu dong retry neu loi tam thoi.
      // Ban sao cua fix nay o apps/project-task-service (22/08/2026) - file nay la MAU THAM CHIEU
      // nhung chinh no lai chua duoc ap dung fix, phat hien lai qua dot ra soat toan du an lan 3.
      let publishedCount = 0;
      for (const record of pending) {
        try {
          const topic = EVENT_TYPE_TOPIC_MAP[record.eventType as EventType] ?? KAFKA_TOPICS.HRM;
          const event: DomainEvent = {
            eventId: record.eventId,
            eventType: record.eventType,
            occurredAt: record.occurredAt.toISOString(),
            organizationId: record.organizationId,
            producer: record.producer,
            payload: record.payload,
          };
          await this.kafkaProducer.publish(topic, event);
          record.published = true;
          await this.outboxRepo.save(record);
          publishedCount++;
        } catch (recordError) {
          this.logger.error(
            `Loi khi publish outbox event ${record.eventId} (eventType=${record.eventType}), bo qua de khong chan cac record khac`,
            recordError as Error,
          );
        }
      }

      if (publishedCount > 0) {
        this.logger.log(`Da publish ${publishedCount} su kien tu outbox`);
      }
    } catch (error) {
      this.logger.error('Loi khi publish outbox events', error as Error);
    } finally {
      this.isRunning = false;
    }
  }
}
