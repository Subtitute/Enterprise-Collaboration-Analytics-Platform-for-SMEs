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
    // 22/07/2026: kiem tra "envelope" ngay khi vao ham (chay ngay sau JSON.parse thanh cong o
    // eachMessage() ben tren, khong co buoc nao xen giua) - Technical_Spec.md muc 14 ("loi
    // payload khong hop le bi bo qua va chi log lai"). Dat kiem tra o day (thay vi ngay trong
    // callback eachMessage()) de co the unit-test doc lap qua handleEvent(), giong cac nhanh
    // loi khac cua ham nay (xem kafka-consumer.service.spec.ts). Truoc fix nay, 1 message JSON
    // hop le VE CU PHAP nhung THIEU truong bat buoc se lam FactWriterService.* nem loi (vd
    // Postgres 23502 not-null violation), bi rethrow GIONG loi ha tang tam thoi va khien
    // kafkajs redeliver MAI MAI cung 1 "poison pill".
    if (!isValidDomainEventEnvelope(event)) {
      this.logger.error(
        `Bo qua event KHONG HOP LE (thieu truong bat buoc eventId/eventType/organizationId/payload): ${JSON.stringify(event)}`,
      );
      return;
    }

    try {
      // 1. Luon ghi vao fact_user_activity - phuc vu feed "Hoat dong gan day" (moi event).
      // 22/07/2026: bat lai gia tri tra ve (co phai dong MOI hay khong) - `ON CONFLICT DO
      // NOTHING` khien INSERT nay co the la no-op neu eventId da duoc ghi truoc do
      // (OutboxPublisherJob phia producer publish trung, Technical_Spec.md muc 4.1). Truoc fix
      // nay gia tri nay bi bo qua nen emitActivity() van bi goi lan 2 cho cung 1 event du fact
      // table khong bi ghi trung - lam real-time push mat idempotent (xem fact-writer.service.ts).
      const isNewEvent = await this.factWriter.recordUserActivity(event);

      // 2. Ghi bo sung theo loai su kien.
      if (event.eventType.startsWith('task.') || event.eventType.startsWith('project.')) {
        await this.factWriter.recordTaskEvent(event);
      } else if (event.eventType.startsWith('document.')) {
        await this.factWriter.recordDocumentEvent(event);
      }

      // 3. Day cap nhat real-time cho Dashboard cua dung to chuc - 22/07/2026: CHI day khi day
      // la lan xu ly DAU TIEN cua eventId nay (isNewEvent = true), khong day lai cho ban ghi
      // trung de dong bo voi tinh idempotent da co cua du lieu persist.
      if (!isNewEvent) {
        this.logger.debug(
          `Bo qua emitActivity cho event trung (eventId=${event.eventId}) - fact_user_activity da co ban ghi nay tu lan xu ly truoc.`,
        );
        return;
      }

      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const actorId = typeof payload.actorId === 'string' ? payload.actorId : null;
      this.gateway.emitActivity(event.organizationId, {
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        actorId,
      });
    } catch (error) {
      // 22/07/2026: bo sung nhanh loi DU LIEU vinh vien (Postgres SQLSTATE 22P02/23502/23503 -
      // vd 1 truong trong payload khong phai UUID hop le, hoac thieu truong bat buoc) - retry
      // lai CUNG message se LUON that bai giong nhau (khac loi ha tang tam thoi o duoi), nen
      // log muc error kem noi dung message goc de debug VA BO QUA (khong rethrow) de kafkajs
      // commit offset, tranh wedge vinh vien 1 partition boi 1 "poison pill" (Technical_Spec.md
      // muc 14). Rieng loi trung khoa (eventId) da duoc `ON CONFLICT DO NOTHING` xu ly o muc SQL
      // ngay trong FactWriterService, KHONG roi toi day.
      if (isPermanentDataError(error)) {
        this.logger.error(
          `Bo qua event LOI DU LIEU vinh vien tu Postgres (eventType=${event.eventType}, eventId=${event.eventId}, ma loi=${(error as { code?: string }).code}): ${(error as Error).message} - noi dung event: ${JSON.stringify(event)}`,
        );
        return;
      }

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

/**
 * 22/07/2026: kiem tra 1 DomainEvent (da JSON.parse thanh cong) co du 4 truong bat buoc hay
 * khong - eventId, eventType, organizationId, payload (packages/common-dto/src/events/
 * event-envelope.ts). Dung "duck typing" thay vi import class/schema tu common-dto de giu
 * dung nguyen tac service nay chi phu thuoc vao KIEU (type-only) cua @app/common-dto.
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

/**
 * 22/07/2026: nhan dien loi Postgres THUOC VE DU LIEU (khong the phuc hoi bang retry) qua ma
 * loi SQLSTATE ma pg/TypeORM dua vao thuoc tinh `code` cua Error: `22P02` (invalid text
 * representation - vd 1 truong khong phai UUID hop le duoc gan cho cot kieu UUID), `23502`
 * (not-null violation - thieu truong bat buoc), `23503` (foreign-key violation). KHAC voi loi
 * ha tang tam thoi (connection refused, timeout,...) - nhung loi do van phai rethrow de kafkajs
 * retry (xem handleEvent() o tren).
 */
const PERMANENT_POSTGRES_ERROR_CODES = new Set(['22P02', '23502', '23503']);
function isPermanentDataError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: string }).code;
  return typeof code === 'string' && PERMANENT_POSTGRES_ERROR_CODES.has(code);
}
