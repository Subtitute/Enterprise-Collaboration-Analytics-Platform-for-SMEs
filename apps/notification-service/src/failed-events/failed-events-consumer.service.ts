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
 *
 * 26/08/2026: bo sung consumer.on(CRASH,...) + tu khoi dong lai voi backoff mu dan - phat hien
 * qua ra soat: consumer RIENG nay (khac voi KafkaConsumerService chinh, da duoc fix 22/08/2026)
 * van CHUA co co che phuc hoi sau CRASH. Neu Kafka mat ket noi keo dai va kafkajs het ngan sach
 * retry noi bo (retry.retries=8 o onModuleInit()), vong lap consumer nay se dung han VINH VIEN,
 * am tham - tien trinh Node van song binh thuong va /health van bao khoe (chi ping Mongo, khong
 * biet gi ve trang thai consumer nay), khien man hinh quan tri GET /failed-events ngung nhan ban
 * ghi loi MOI ma khong ai hay biet cho toi khi co nguoi thu cong restart container. Mirror dung
 * pattern cua KafkaConsumerService (xem ghi chu chi tiet tai kafka-consumer.service.ts).
 */
@Injectable()
export class FailedEventsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FailedEventsConsumerService.name);
  private kafka: Kafka;
  private consumer: Consumer;
  // 26/08/2026: dem so lan da thu khoi dong lai LIEN TIEP sau 1 lan CRASH - dung tinh backoff mu
  // dan, ve 0 ngay khi khoi dong lai thanh cong. Mirror KafkaConsumerService.restartAttempt.
  private restartAttempt = 0;
  // 26/08/2026: PHAI huy trong onModuleDestroy() - neu khong, module bi pha huy (vd container
  // redeploy) DUNG luc dang "ngu" giua 1 lan backoff se khien timer nay fire sau khi service da
  // tat, tu goi lai startConsuming() tren 1 consumer da disconnect() - mirror dung loi da fix
  // 25/08/2026 cua KafkaConsumerService (xem ghi chu tai kafka-consumer.service.ts).
  private restartTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

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
    this.registerCrashHandler();
    await this.startConsuming();
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    await this.consumer?.disconnect();
  }

  // 26/08/2026: tach tu onModuleInit() (giu nguyen logic connect/subscribe/run goc) de co the goi
  // lai duoc TU restartWithBackoff() ben duoi sau 1 lan CRASH, khong chi 1 lan duy nhat luc khoi
  // dong module - mirror KafkaConsumerService.startConsuming().
  private async startConsuming(): Promise<void> {
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

  // 26/08/2026: mirror KafkaConsumerService.registerCrashHandler() - xem ghi chu 26/08/2026 dau
  // file ve ly do can bo sung handler nay.
  private registerCrashHandler(): void {
    this.consumer.on(this.consumer.events.CRASH, (event) => {
      this.logger.error(
        `Kafka DLQ consumer CRASH (group=${KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE_DLQ}): ${event.payload.error.message}. ` +
          `kafkajs tu restart: ${event.payload.restart}.`,
      );
      if (!event.payload.restart) {
        void this.restartWithBackoff();
      }
    });
  }

  // 26/08/2026: mirror KafkaConsumerService.restartWithBackoff() (backoff mu dan, toi da 30s).
  private async restartWithBackoff(): Promise<void> {
    if (this.destroyed) return;
    this.restartAttempt += 1;
    const delayMs = Math.min(30_000, 1000 * 2 ** this.restartAttempt);
    this.logger.warn(
      `Se thu khoi dong lai Kafka DLQ consumer sau ${delayMs}ms (lan thu ${this.restartAttempt})...`,
    );
    await new Promise<void>((resolve) => {
      this.restartTimer = setTimeout(resolve, delayMs);
    });
    if (this.destroyed) return;
    try {
      await this.startConsuming();
      this.logger.log('Kafka DLQ consumer da khoi dong lai thanh cong sau CRASH.');
      this.restartAttempt = 0;
    } catch (err) {
      this.logger.error(
        `Khoi dong lai Kafka DLQ consumer that bai (lan thu ${this.restartAttempt}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      void this.restartWithBackoff();
    }
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
