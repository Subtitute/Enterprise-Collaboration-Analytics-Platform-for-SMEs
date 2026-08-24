import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';
import { DeadLetterEnvelope, DomainEvent, KAFKA_CONSUMER_GROUPS, KAFKA_TOPICS } from '@app/common-dto';
import { NotificationsService } from '../notifications/notifications.service';
import { buildNotificationFromEvent } from './event-notification-builder';
// 28/07/2026: bo sung KafkaProducerService de day message loi vao KAFKA_TOPICS.DLQ - xem
// publishToDlq() ben duoi (Technical_Spec.md muc 14 - nang cap Dead Letter Queue).
import { KafkaProducerService } from './kafka-producer.service';

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

  // 28/07/2026: dem so lan retry cho 1 eventId (loi TAM THOI - xem nhanh catch trong
  // handleMessage() ben duoi) truoc khi CHAP NHAN THUA CUOC va day vao DLQ - Technical_Spec.md
  // muc 14 ("Kafka consumer chua co Dead Letter Queue", nay da co). GIOI HAN DA BIET: dem nay chi
  // luu TRONG BO NHO (Map), KHONG ben vung qua lan restart service - neu service restart giua
  // chung, dem cho eventId dang do ve 0 va message lai duoc thu du 5 lan nua tu dau. Day la danh
  // doi CHAP NHAN DUOC (khong dung Redis/DB de persist dem nay) vi muc dich chi la chan 1
  // "poison pill" retry VO HAN lam wedge partition, khong phai 1 yeu cau nghiep vu can dem chinh
  // xac tuyet doi qua moi lan restart.
  private readonly retryAttempts = new Map<string, number>();
  private readonly maxRetryAttempts = 5;
  // 22/08/2026: dem so lan da thu khoi dong lai LIEN TIEP sau 1 lan CRASH - dung tinh backoff mu
  // dan, ve 0 ngay khi khoi dong lai thanh cong. Xem registerCrashHandler()/restartWithBackoff().
  private restartAttempt = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    // 28/07/2026: xem import o tren.
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.kafka = new Kafka({
      clientId: 'notification-service',
      brokers: [this.configService.get<string>('kafka.broker')!],
      retry: { retries: 8 },
    });
    this.consumer = this.kafka.consumer({ groupId: KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE });
    this.registerCrashHandler();
    await this.startConsuming();
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.disconnect();
  }

  // 22/08/2026: tach tu onModuleInit() (giu nguyen logic connect/subscribe/run goc) de co the goi
  // lai duoc TU restartWithBackoff() ben duoi sau 1 lan CRASH, khong chi 1 lan duy nhat luc khoi
  // dong module.
  private async startConsuming(): Promise<void> {
    await this.consumer.connect();
    // 28/07/2026: liet ke THANG 3 topic domain event thay vi Object.values(KAFKA_TOPICS) nhu
    // truoc day - tu khi them KAFKA_TOPICS.DLQ (packages/common-dto), Object.values(KAFKA_TOPICS)
    // se bao gom CA topic DLQ. Neu consumer nay (group NOTIFICATION_SERVICE, chuyen xu ly
    // DomainEvent) subscribe nham topic DLQ, no se doc lai chinh cac DeadLetterEnvelope da bi day
    // vao DLQ, coi la "envelope khong hop le" (thieu payload/occurredAt/producer so voi DomainEvent)
    // roi day NGUOC lai DLQ - tao vong lap vo han lam phinh to topic DLQ. Topic DLQ CHI duoc doc
    // boi FailedEventsConsumerService rieng (group KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE_DLQ)
    // - xem failed-events/failed-events-consumer.service.ts.
    // 04/08/2026: them KAFKA_TOPICS.CRM (CRM-lite - Technical_Spec.md muc 16) vao danh sach
    // topic domain event duoc subscribe - xem event-notification-builder.ts (case DEAL_STAGE_CHANGED).
    // 05/08/2026: them KAFKA_TOPICS.HRM (HRM-lite - Technical_Spec.md muc 17), cung ly do.
    const domainEventTopics = [
      KAFKA_TOPICS.IAM,
      KAFKA_TOPICS.PROJECT_TASK,
      KAFKA_TOPICS.DOCUMENT,
      KAFKA_TOPICS.CRM,
      KAFKA_TOPICS.HRM,
    ];
    await this.consumer.subscribe({
      topics: domainEventTopics,
      fromBeginning: false,
    });
    await this.consumer.run({
      eachMessage: (payload) => this.handleMessage(payload),
    });

    this.logger.log(
      `Da ket noi Kafka consumer (group=${KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE}), ` +
        `subscribe topics: ${domainEventTopics.join(', ')}`,
    );
  }

  // 22/08/2026: phat hien qua rieng ra soat - truoc day KHONG co consumer.on(CRASH,...) nao. Khi
  // kafkajs het ngan sach retry NOI BO (vd Kafka mat ket noi keo dai, vuot qua `retry.retries=8` o
  // onModuleInit()) va tu dung han vong lap consumer (khac voi retryAttempts/DLQ o handleMessage()
  // ben tren, von xu ly loi TUNG message - day la loi cua CA VONG LAP), tien trinh Node VAN SONG
  // BINH THUONG (khong exception nao thoat ra ngoai) va /health van bao "khoe manh" (chi ping
  // Mongo, khong biet gi ve trang thai consumer) - toan bo viec tao thong bao tu su kien NGUNG
  // VINH VIEN, am tham, cho toi khi co nguoi thu cong restart container. Tu khoi dong lai voi
  // backoff mu dan (toi da 30s) de tu phuc hoi khi Kafka on dinh tro lai.
  private registerCrashHandler(): void {
    this.consumer.on(this.consumer.events.CRASH, (event) => {
      this.logger.error(
        `Kafka consumer CRASH (group=${KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE}): ${event.payload.error.message}. ` +
          `kafkajs tu restart: ${event.payload.restart}.`,
      );
      if (!event.payload.restart) {
        void this.restartWithBackoff();
      }
    });
  }

  private async restartWithBackoff(): Promise<void> {
    this.restartAttempt += 1;
    const delayMs = Math.min(30_000, 1000 * 2 ** this.restartAttempt);
    this.logger.warn(`Se thu khoi dong lai Kafka consumer sau ${delayMs}ms (lan thu ${this.restartAttempt})...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      await this.startConsuming();
      this.logger.log('Kafka consumer da khoi dong lai thanh cong sau CRASH.');
      this.restartAttempt = 0;
    } catch (err) {
      this.logger.error(
        `Khoi dong lai Kafka consumer that bai (lan thu ${this.restartAttempt}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      void this.restartWithBackoff();
    }
  }

  private async handleMessage({ topic, message }: EachMessagePayload): Promise<void> {
    if (!message.value) return;

    let event: DomainEvent;
    try {
      event = JSON.parse(message.value.toString()) as DomainEvent;
    } catch (err) {
      this.logger.warn(`Khong parse duoc message JSON tu topic ${topic}: ${(err as Error).message}`);
      // 28/07/2026: day vao DLQ (Technical_Spec.md muc 14) de admin nhin thay va tra cuu lai loi
      // nay qua GET /failed-events, thay vi chi log roi mat dau vet nhu truoc. Message JSON hong
      // khong the retry thanh cong (se luon that bai giong het) nen KHONG rethrow.
      await this.publishToDlq({
        eventId: null,
        eventType: null,
        organizationId: null,
        sourceTopic: topic,
        errorType: 'MALFORMED_JSON',
        errorMessage: (err as Error).message,
        attempts: 1,
        rawPayload: message.value.toString(),
      });
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
      // 28/07/2026: day vao DLQ, lay lai best-effort cac truong eventId/eventType/organizationId
      // NEU co (vd chi thieu 1 truong trong so 4 truong bat buoc) - `event` o day co the la bat ky
      // gia tri JSON nao (ke ca null/mang/chuoi) nen phai kiem tra kieu du lieu truoc khi doc
      // thuoc tinh, tranh nem TypeError khi vd message la JSON literal "null".
      const safeEvent = typeof event === 'object' && event !== null ? (event as Record<string, unknown>) : {};
      await this.publishToDlq({
        eventId: typeof safeEvent.eventId === 'string' && safeEvent.eventId.length > 0 ? safeEvent.eventId : null,
        eventType:
          typeof safeEvent.eventType === 'string' && safeEvent.eventType.length > 0 ? safeEvent.eventType : null,
        organizationId:
          typeof safeEvent.organizationId === 'string' && safeEvent.organizationId.length > 0
            ? safeEvent.organizationId
            : null,
        sourceTopic: topic,
        errorType: 'INVALID_ENVELOPE',
        errorMessage: 'Thieu truong bat buoc eventId/eventType/organizationId/payload',
        attempts: 1,
        rawPayload: JSON.stringify(event),
      });
      return;
    }

    const draft = buildNotificationFromEvent(event);
    if (!draft) {
      this.logger.debug(`Bo qua eventType khong sinh thong bao: ${event.eventType} (topic=${topic})`);
      return;
    }

    try {
      await this.notificationsService.createFromEvent(event.organizationId, event.eventId, draft);
      // 28/07/2026: xu ly thanh cong -> xoa dem retry (neu CO tu cac lan that bai truoc do cua
      // CUNG eventId nay) de khong ro ri bo nho Map theo thoi gian chay cua service.
      this.retryAttempts.delete(event.eventId);
    } catch (err) {
      // Loi ghi Mongo la loi TAM THOI (vd Mongo down/timeout) - log o muc error VA rethrow de
      // kafkajs KHONG commit offset cho message nay; consumer group se retry (Technical_Spec.md
      // muc 14 - "Kafka consumer chua co DLQ", loi ha tang tam thoi duoc retry o muc consumer).
      // Khac voi loi parse JSON o tren (khong the retry thanh cong -> log warn + bo qua).
      //
      // 28/07/2026: GIOI HAN so lan retry (nang cap DLQ) - truoc fix nay, 1 loi ha tang KEO DAI
      // (vd Mongo down that su, khong phai 1 blip thoang qua) khien kafkajs redeliver CUNG 1
      // message VO HAN LAN, wedge ca partition mai mai (khong message nao SAU no trong cung
      // partition duoc xu ly) cho toi khi ha tang duoc khoi phuc thu cong. Nay dem so lan thu cho
      // tung eventId; den lan thu ${maxRetryAttempts} thi CHAP NHAN THUA CUOC: day vao DLQ
      // (errorType RETRY_EXHAUSTED) va tra ve binh thuong (khong rethrow nua) de kafkajs commit
      // offset, giai phong partition cho cac message tiep theo - danh doi chap nhan mat 1
      // notification thay vi block toan bo hang doi vo thoi han.
      const attempts = (this.retryAttempts.get(event.eventId) ?? 0) + 1;
      if (attempts >= this.maxRetryAttempts) {
        this.retryAttempts.delete(event.eventId);
        this.logger.error(
          `Da het ${this.maxRetryAttempts} lan retry cho event ${event.eventId} (type=${event.eventType}) - day vao DLQ va bo qua: ${(err as Error).message}`,
        );
        await this.publishToDlq({
          eventId: event.eventId,
          eventType: event.eventType,
          organizationId: event.organizationId,
          sourceTopic: topic,
          errorType: 'RETRY_EXHAUSTED',
          errorMessage: (err as Error).message,
          attempts: this.maxRetryAttempts,
          rawPayload: JSON.stringify(event),
        });
        return;
      }

      this.retryAttempts.set(event.eventId, attempts);
      this.logger.error(
        `Loi khi tao notification tu event ${event.eventId} (type=${event.eventType}), lan thu ${attempts}/${this.maxRetryAttempts}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  /**
   * 28/07/2026: day 1 DeadLetterEnvelope vao KAFKA_TOPICS.DLQ (Technical_Spec.md muc 14 - nang
   * cap Dead Letter Queue). Boc trong try/catch RIENG (khac voi loi nghiep vu da duoc xu ly o cac
   * noi goi ham nay) vi day la 1 hanh dong "best-effort ghi log mo rong" - neu ban than Kafka
   * broker cung dang gap su co (vi du chinh nguyen nhan gay ra loi RETRY_EXHAUSTED o tren), KHONG
   * duoc de loi publish DLQ nay lam crash/rethrow tiep tren consumer, gay hieu ung day chuyen.
   */
  private async publishToDlq(fields: Omit<DeadLetterEnvelope, 'sourceService' | 'failedAt'>): Promise<void> {
    const envelope: DeadLetterEnvelope = {
      ...fields,
      sourceService: 'notification-service',
      failedAt: new Date().toISOString(),
    };
    try {
      // 28/07/2026: ep kieu DeadLetterEnvelope -> DomainEvent vi KafkaProducerService.publish()
      // (clone tu iam-service, chi doi clientId - xem kafka-producer.service.ts) chi thao tac
      // JSON.stringify(event) va doc event.organizationId de lam key partition; DeadLetterEnvelope
      // khong khop 100% shape DomainEvent (thieu occurredAt/producer, organizationId co the null)
      // nhung du de dung chung 1 ham publish() nay ma khong can them 1 overload/generic rieng cho
      // 1 wrapper mong nhu vay.
      await this.kafkaProducer.publish(KAFKA_TOPICS.DLQ, envelope as unknown as DomainEvent);
    } catch (err) {
      this.logger.error(
        `Khong the publish message vao DLQ (topic=${KAFKA_TOPICS.DLQ}, eventType=${envelope.eventType}): ${(err as Error).message}`,
      );
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
