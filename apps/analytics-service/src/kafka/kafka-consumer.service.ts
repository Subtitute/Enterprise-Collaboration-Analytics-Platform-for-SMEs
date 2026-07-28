import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Consumer, Kafka } from 'kafkajs';
import {
  DeadLetterEnvelope,
  DeadLetterErrorType,
  DomainEvent,
  EVENT_TYPES,
  KAFKA_CONSUMER_GROUPS,
  KAFKA_TOPICS,
  // 28/07/2026: DeadLetterEnvelope/DeadLetterErrorType - schema chuan de day message loi vao
  // KAFKA_TOPICS.DLQ (xem publishToDlq() ben duoi va Technical_Spec.md muc 14).
  // EVENT_TYPES.USER_REGISTERED/USER_DEPARTMENT_CHANGED - nhan dien nhanh cap nhat dim_user
  // (KPI theo phong ban) ben duoi trong handleEvent().
} from '@app/common-dto';
import { FactWriterService } from '../analytics/fact-writer.service';
import { AnalyticsGateway } from '../realtime/analytics.gateway';
// 28/07/2026: producer moi cua service nay - dung DUY NHAT de tu phat message vao DLQ.
import { KafkaProducerService } from './kafka-producer.service';

/**
 * Consumer duy nhat cua Analytics Service - lang nghe ca 3 topic (iam/project-task/document)
 * bang 1 consumer group `analytics-service-group` (Technical_Spec.md muc 4.2, muc 3.6).
 *
 * Moi message deu duoc ghi vao fact_user_activity (idempotent theo eventId - xem
 * FactWriterService), sau do tuy eventType ma ghi bo sung vao fact_task_events, fact_document_events
 * hoac dim_user (28/07/2026: bang lookup phong ban cua user, phuc vu KPI theo phong ban), roi day
 * cap nhat real-time qua AnalyticsGateway.
 *
 * QUAN TRONG (Technical_Spec.md muc 4.1 - gioi han da biet): OutboxPublisherJob phia producer
 * co the phat trung 1 event neu crash giua luc publish -> service nay PHAI dung idempotent
 * (ON CONFLICT DO NOTHING theo eventId), KHONG duoc gia dinh Kafka giao dung 1 lan.
 *
 * 28/07/2026: bo sung Dead Letter Queue (Technical_Spec.md muc 14, truoc day "chua co DLQ") - ca
 * 4 nhanh loi (JSON khong hop le, envelope thieu truong, loi du lieu Postgres vinh vien, va loi ha
 * tang KEO DAI vuot qua nguong retry) gio day day message loi sang KAFKA_TOPICS.DLQ (xem
 * publishToDlq()) thay vi CHI log-and-skip nhu truoc, tranh mat trang du lieu loi.
 */
@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka;
  private consumer: Consumer;
  // 28/07/2026: dem so lan retry LIEN TIEP cho tung eventId (dung o nhanh loi TAM THOI trong
  // handleEvent() ben duoi) - key la eventId, value la so lan da thu. GIOI HAN DA BIET (chap nhan
  // duoc trong pham vi do an, khong persist Redis/DB): Map nay o trong bo nho tien trinh, MAT het
  // khi service restart -> 1 message dang "ket" giua chung se duoc cap lai NGUYEN VEN
  // `maxRetryAttempts` luot moi sau restart (khong cong don voi so lan da thu truoc do).
  private readonly retryAttempts = new Map<string, number>();
  // 28/07/2026: nguong so lan retry toi da cho 1 eventId truoc khi bi coi la RETRY_EXHAUSTED va
  // day sang DLQ thay vi tiep tuc rethrow cho kafkajs redeliver vo han.
  private readonly maxRetryAttempts = 5;

  constructor(
    private readonly configService: ConfigService,
    private readonly factWriter: FactWriterService,
    private readonly gateway: AnalyticsGateway,
    // 25/07/2026 (Fix 2 - Major, audit): can DataSource truc tiep de mo 1 transaction Postgres
    // boc quanh toan bo cac lenh ghi fact table cua CUNG 1 event (xem handleEvent() ben duoi).
    @InjectDataSource() private readonly dataSource: DataSource,
    // 28/07/2026: can KafkaProducerService de tu phat message vao KAFKA_TOPICS.DLQ khi 1 trong 4
    // nhanh loi cua service nay xay ra (xem publishToDlq() ben duoi).
    private readonly kafkaProducer: KafkaProducerService,
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
      // 28/07/2026: chuyen toan bo noi dung callback nay sang processMessage() (private method)
      // de co the unit-test doc lap nhanh loi MALFORMED_JSON (day sang DLQ) ma khong can 1 ket
      // noi Kafka that - giong ly do handleEvent() da duoc tach truoc do (xem
      // kafka-consumer.service.spec.ts).
      eachMessage: async ({ topic, message }) => this.processMessage(topic, message.value),
    });

    this.logger.log(
      `Da ket noi Kafka consumer (group=${KAFKA_CONSUMER_GROUPS.ANALYTICS_SERVICE}, topics=${KAFKA_TOPICS.IAM},${KAFKA_TOPICS.PROJECT_TASK},${KAFKA_TOPICS.DOCUMENT})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.disconnect();
  }

  // 28/07/2026: tach tu callback eachMessage() cua consumer.run() o onModuleInit() ben tren -
  // giu nguyen logic goc (parse JSON roi goi handleEvent()), chi khac la gio co the goi truc
  // tiep tu unit test (xem kafka-consumer.service.spec.ts) vi khong con phu thuoc Kafka that.
  private async processMessage(topic: string, rawValue: Buffer | null): Promise<void> {
    if (!rawValue) return;
    let event: DomainEvent;
    try {
      event = JSON.parse(rawValue.toString()) as DomainEvent;
    } catch (error) {
      // Loi KHONG THE PHUC HOI (malformed JSON) - retry cung message se luon that bai giong
      // nhau, nen log o muc warn va BO QUA (khong rethrow) de kafkajs commit offset va
      // chuyen sang message tiep theo. Khac voi loi ghi TimescaleDB o handleEvent() ben duoi.
      this.logger.warn(`Khong parse duoc message JSON tu topic ${topic}: ${(error as Error).message}`);
      // 28/07/2026: day sang DLQ (errorType MALFORMED_JSON) truoc khi bo qua - Technical_Spec.md
      // muc 14 (nay da co DLQ), tranh mat han noi dung message loi (truoc day chi con trong log).
      await this.publishToDlq({
        eventId: null,
        eventType: null,
        organizationId: null,
        sourceTopic: topic,
        errorType: 'MALFORMED_JSON',
        errorMessage: (error as Error).message,
        attempts: 1,
        rawPayload: rawValue.toString(),
      });
      return;
    }
    // 28/07/2026: truyen them `topic` (topic Kafka GOC) de cac nhanh loi trong handleEvent() ghi
    // dung sourceTopic khi day sang DLQ (truoc day handleEvent chi nhan event).
    await this.handleEvent(event, topic);
  }

  private async handleEvent(event: DomainEvent, topic: string): Promise<void> {
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
      // 28/07/2026: day sang DLQ truoc khi bo qua - best-effort lay eventId/eventType/organizationId
      // tu object GOC (event luc nay CHUA qua duoc isValidDomainEventEnvelope() nen cac truong nay
      // co the thieu/sai kieu, khong the tin tuong kieu DomainEvent da khai bao tren tham so ham).
      const raw = event as unknown as Record<string, unknown>;
      await this.publishToDlq({
        eventId: typeof raw.eventId === 'string' ? raw.eventId : null,
        eventType: typeof raw.eventType === 'string' ? raw.eventType : null,
        organizationId: typeof raw.organizationId === 'string' ? raw.organizationId : null,
        sourceTopic: topic,
        errorType: 'INVALID_ENVELOPE',
        errorMessage: 'Thieu truong bat buoc eventId/eventType/organizationId/payload',
        attempts: 1,
        rawPayload: JSON.stringify(event),
      });
      return;
    }

    try {
      // 25/07/2026 (Fix 2 - Major, audit): boc buoc 1 (ghi fact_user_activity) + buoc 2 (ghi bo
      // sung fact_task_events/fact_document_events) cua CUNG 1 event trong 1 transaction Postgres
      // DUY NHAT (khong con la 2 lenh INSERT doc lap). Truoc fix nay, neu recordUserActivity()
      // ghi thanh cong (isNewEvent=true, ban ghi MOI) nhung buoc ghi SAU do
      // (recordTaskEvent()/recordDocumentEvent()) that bai TAM THOI (vd TimescaleDB blip) khien
      // toan bo handleEvent() rethrow va Kafka redeliver message: o lan redeliver,
      // recordUserActivity() gio dung ON CONFLICT DO NOTHING (ban ghi da co tu lan truoc) va tra
      // ve isNewEvent=false -> nhanh "if (!isNewEvent) return" ben duoi bo qua emitActivity() VINH
      // VIEN, MAC DU buoc ghi con lai luc nay da thanh cong va fact table cuoi cung day du/dung.
      // Nay ca 2 buoc cung commit/rollback nhu 1 don vi nguyen tu: neu 1 trong 2 that bai, ca 2
      // ROLLBACK cung nhau, lan redeliver sau ghi lai TU DAU va recordUserActivity() se lai tra
      // ve isNewEvent=true dung nhu ban chat "lan xu ly dau tien" cua no.
      let isNewEvent = false;
      await this.dataSource.transaction(async (manager) => {
        // 1. Luon ghi vao fact_user_activity - phuc vu feed "Hoat dong gan day" (moi event).
        // 22/07/2026: bat lai gia tri tra ve (co phai dong MOI hay khong) - `ON CONFLICT DO
        // NOTHING` khien INSERT nay co the la no-op neu eventId da duoc ghi truoc do
        // (OutboxPublisherJob phia producer publish trung, Technical_Spec.md muc 4.1). Truoc fix
        // nay gia tri nay bi bo qua nen emitActivity() van bi goi lan 2 cho cung 1 event du fact
        // table khong bi ghi trung - lam real-time push mat idempotent (xem fact-writer.service.ts).
        isNewEvent = await this.factWriter.recordUserActivity(event, manager);

        // 2. Ghi bo sung theo loai su kien - CUNG transaction voi buoc 1 (xem ghi chu Fix 2 o tren).
        if (event.eventType.startsWith('task.') || event.eventType.startsWith('project.')) {
          await this.factWriter.recordTaskEvent(event, manager);
        } else if (event.eventType.startsWith('document.')) {
          await this.factWriter.recordDocumentEvent(event, manager);
        } else if (
          event.eventType === EVENT_TYPES.USER_REGISTERED ||
          event.eventType === EVENT_TYPES.USER_DEPARTMENT_CHANGED
        ) {
          // 28/07/2026: cap nhat dim_user (bang lookup phong ban HIEN TAI cua user) tu ca 2
          // nguon: user MOI dang ky (USER_REGISTERED, mang san departmentId ban dau) VA user da
          // ton tai doi phong ban qua PATCH /users/:id hoac ban resync dinh ky luc IAM Service
          // khoi dong lai (USER_DEPARTMENT_CHANGED, an toan replay - xem event-types.ts). Phuc vu
          // KPI theo phong ban (AnalyticsService.computeSummary()/getTaskStatusBreakdown()/
          // getProjectProgress(), tham so departmentId).
          await this.factWriter.upsertUserDepartment(event, manager);
        }
      });

      // 3. Day cap nhat real-time cho Dashboard cua dung to chuc - CHI sau khi transaction o
      // tren COMMIT thanh cong. 22/07/2026: CHI day khi day la lan xu ly DAU TIEN cua eventId
      // nay (isNewEvent = true), khong day lai cho ban ghi trung de dong bo voi tinh idempotent
      // da co cua du lieu persist.
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
        // 28/07/2026: day sang DLQ truoc khi bo qua - luu lai payload loi de co the kiem tra/replay
        // thu cong sau nay thay vi CHI nam trong log (Technical_Spec.md muc 14).
        await this.publishToDlq({
          eventId: event.eventId,
          eventType: event.eventType,
          organizationId: event.organizationId,
          sourceTopic: topic,
          errorType: 'PERMANENT_DATA_ERROR',
          errorMessage: (error as Error).message,
          attempts: 1,
          rawPayload: JSON.stringify(event),
        });
        return;
      }

      // Loi TAM THOI (vd TimescaleDB down/timeout khi FactWriterService.* goi DataSource.query)
      // - log o muc error VA rethrow de kafkajs KHONG commit offset cho message nay; consumer
      // group se retry. Khac voi loi parse JSON o eachMessage()/processMessage() (khong the retry
      // thanh cong -> log warn + bo qua, xem tren).
      this.logger.error(
        `Loi khi xu ly event ${event.eventType} (eventId=${event.eventId})`,
        error as Error,
      );

      // 28/07/2026: gioi han so lan retry (Technical_Spec.md muc 14, nay da co DLQ) - neu CUNG 1
      // eventId da rethrow lien tiep du `maxRetryAttempts` lan, KHONG rethrow nua ma day sang DLQ
      // (errorType RETRY_EXHAUSTED) roi return de kafkajs commit offset va thoat khoi vong lap
      // redeliver vo han (vd TimescaleDB down keo dai nhieu gio). Neu chua toi nguong, giu nguyen
      // hanh vi rethrow cu ben duoi.
      const attemptCount = (this.retryAttempts.get(event.eventId) ?? 0) + 1;
      if (attemptCount >= this.maxRetryAttempts) {
        this.retryAttempts.delete(event.eventId);
        await this.publishToDlq({
          eventId: event.eventId,
          eventType: event.eventType,
          organizationId: event.organizationId,
          sourceTopic: topic,
          errorType: 'RETRY_EXHAUSTED',
          errorMessage: (error as Error).message,
          attempts: attemptCount,
          rawPayload: JSON.stringify(event),
        });
        return;
      }
      this.retryAttempts.set(event.eventId, attemptCount);
      throw error;
    }
  }

  /**
   * 28/07/2026: goi chung cho ca 4 nhanh loi (MALFORMED_JSON o processMessage(), INVALID_ENVELOPE/
   * PERMANENT_DATA_ERROR/RETRY_EXHAUSTED o handleEvent()) - chuan hoa thanh 1 DeadLetterEnvelope
   * (@app/common-dto) roi day sang KAFKA_TOPICS.DLQ, thay vi CHI log-and-skip nhu truoc
   * (Technical_Spec.md muc 14). Boc try/catch RIENG quanh buoc publish: neu chinh Kafka (hoac
   * broker cua topic DLQ) dang gap su co, CHI log loi va KHONG duoc de loi nay lam sap/rethrow
   * lam hong nhanh xu ly loi GOC dang chay (tranh loi chong loi).
   */
  private async publishToDlq(params: {
    eventId: string | null;
    eventType: string | null;
    organizationId: string | null;
    sourceTopic: string;
    errorType: DeadLetterErrorType;
    errorMessage: string;
    attempts: number;
    rawPayload: string;
  }): Promise<void> {
    const envelope: DeadLetterEnvelope = {
      ...params,
      sourceService: 'analytics-service',
      failedAt: new Date().toISOString(),
    };
    try {
      // 28/07/2026: ep kieu Record<string, unknown> - xem ghi chu tai kafka-producer.service.ts
      // (publish() cua service nay nhan kieu noi long, khac DomainEvent cua ban goc iam-service).
      await this.kafkaProducer.publish(KAFKA_TOPICS.DLQ, envelope as unknown as Record<string, unknown>);
    } catch (err) {
      this.logger.error(`Khong the day event vao DLQ (eventId=${params.eventId}): ${(err as Error).message}`);
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
