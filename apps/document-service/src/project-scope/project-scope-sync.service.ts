import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka } from 'kafkajs';
import { DomainEvent, INTERNAL_SHARED_SECRET_HEADER, KAFKA_CONSUMER_GROUPS, KAFKA_TOPICS } from '@app/common-dto';
import { isPermanentDataError, ProjectMembershipSnapshot, ProjectScopeService } from './project-scope.service';

const SNAPSHOT_PATH = '/api/v1/internal/project-memberships';
const SNAPSHOT_TIMEOUT_MS = 10_000;
const CONSUMER_RESTART_DELAY_MS = 15_000;
// 26/10/2026: so lan thu backfill TRUOC khi chay consumer (5s + 10s + 15s cho); sau do consumer van chay.
export const INITIAL_BACKFILL_ATTEMPTS = 4;
const MAX_BACKOFF_MS = 60_000;

/**
 * 26/10/2026: dong bo read-model "tai lieu theo pham vi du an" - Document Service lan dau tieu thu
 * Kafka. Thu tu co chu dich moi lan khoi dong:
 *  1. Backfill: lay anh chup du an/lead/thanh vien tu Project-Task Service (endpoint noi bo, bi mat
 *     x-internal-secret) va THAY toan bo bang du an - phu du lieu co tu truoc khi co su kien thanh
 *     vien. Thu lai (gian cach tang dan, toi da 60s) cho toi khi Project-Task Service san sang; trong
 *     luc cho, kiem tra quyen dung read-model da luu trong Postgres tu lan chay truoc.
 *  2. ROI moi chay consumer (group rieng, fromBeginning cho group moi): su kien phat sau anh chup
 *     duoc doc lai sau do nen anh chup cu khong bao gio ghi de len thay doi moi hon.
 * Phong ban cua user lay tu iam.events (khong co endpoint noi bo ben IAM) - IAM tu phat lai phong ban
 * cua moi user moi lan khoi dong, nen do tre/lech toi da = toi lan IAM khoi dong ke tiep.
 * Quy mo do an: anh chup TOAN BO moi lan khoi dong la re; quy mo lon can phan trang/doi soat dinh ky.
 *
 * 26/10/2026: backfill loi lau (Project-Task Service sap, sai bi mat...) KHONG con chan consumer: thu
 * INITIAL_BACKFILL_ATTEMPTS lan, van loi thi log error, chay consumer (su kien moi + phong ban IAM van duoc
 * ap dung) va tiep tuc thu backfill o nen. Backfill nen TAM DUNG topic project-task trong luc chup + thay
 * (doi message dang xu ly xong) roi moi chay tiep - anh chup khong ghi de su kien moi hon.
 * Gia dinh 1 instance Document Service (nhieu instance: anh chup cua instance vua khoi dong co the ghi de
 * su kien instance khac vua ap dung - gioi han da ghi nhan).
 */
@Injectable()
export class ProjectScopeSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ProjectScopeSyncService.name);
  private consumer?: Consumer;
  private destroyed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private wake?: () => void;
  private inFlight: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly configService: ConfigService,
    private readonly projectScopeService: ProjectScopeService,
  ) {}

  onApplicationBootstrap(): void {
    // Khong await: /health va API khong phai doi Project-Task Service/Kafka san sang.
    void this.run();
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    this.wake?.();
    await this.consumer?.disconnect();
  }

  async run(): Promise<void> {
    const done = await this.backfill(INITIAL_BACKFILL_ATTEMPTS);
    if (this.destroyed) return;
    await this.startConsumer();
    if (!done) {
      this.logger.error(
        `Backfill read-model du an that bai sau ${INITIAL_BACKFILL_ATTEMPTS} lan - van chay consumer Kafka, tiep tuc thu backfill o nen`,
      );
      void this.backfillInBackground();
    }
  }

  /** Thu toi da `maxAttempts` lan, gian cach tang dan (5s, 10s... toi da 60s); true neu thanh cong. */
  async backfill(maxAttempts: number): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts && !this.destroyed; attempt += 1) {
      try {
        await this.applySnapshot();
        return true;
      } catch (err) {
        this.logger.warn(`Backfill read-model du an that bai (lan ${attempt}): ${(err as Error).message}`);
        if (attempt < maxAttempts) await this.sleep(Math.min(MAX_BACKOFF_MS, 5_000 * attempt));
      }
    }
    return false;
  }

  /** Backfill khi consumer DANG chay: tam dung topic project-task, doi message dang xu ly, chup + thay, chay tiep. */
  async backfillInBackground(): Promise<void> {
    const topics = [{ topic: KAFKA_TOPICS.PROJECT_TASK }];
    for (let attempt = INITIAL_BACKFILL_ATTEMPTS; !this.destroyed; attempt += 1) {
      await this.sleep(Math.min(MAX_BACKOFF_MS, 5_000 * attempt));
      if (this.destroyed) return;
      this.consumer?.pause(topics);
      try {
        await this.inFlight;
        await this.applySnapshot();
        return;
      } catch (err) {
        this.logger.warn(`Backfill nen read-model du an that bai (lan ${attempt + 1}): ${(err as Error).message}`);
      } finally {
        this.consumer?.resume(topics);
      }
    }
  }

  private async applySnapshot(): Promise<void> {
    const snapshot = await this.fetchSnapshot();
    await this.projectScopeService.replaceProjectSnapshot(snapshot);
    this.logger.log(`Da backfill read-model du an: ${snapshot.projects.length} du an (anh chup ${snapshot.takenAt})`);
  }

  async fetchSnapshot(): Promise<ProjectMembershipSnapshot> {
    const baseUrl = this.configService.get<string>('projectTask.url');
    const res = await fetch(`${baseUrl}${SNAPSHOT_PATH}`, {
      headers: { [INTERNAL_SHARED_SECRET_HEADER]: this.configService.get<string>('internalSecret') ?? '' },
      signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as ProjectMembershipSnapshot;
    if (!Array.isArray(body?.projects)) throw new Error('Anh chup khong hop le');
    return body;
  }

  async startConsumer(): Promise<void> {
    try {
      const kafka = new Kafka({
        clientId: 'document-service-consumer',
        brokers: [this.configService.get<string>('kafka.broker') ?? 'localhost:9092'],
        retry: { retries: 8 },
      });
      const consumer = kafka.consumer({ groupId: KAFKA_CONSUMER_GROUPS.DOCUMENT_SERVICE });
      this.consumer = consumer;
      consumer.on(consumer.events.CRASH, (event) => {
        this.logger.error(`Kafka consumer CRASH: ${event.payload.error.message} (kafkajs tu restart: ${event.payload.restart})`);
        if (!event.payload.restart) this.scheduleConsumerRestart();
      });
      await consumer.connect();
      await consumer.subscribe({ topics: [KAFKA_TOPICS.PROJECT_TASK, KAFKA_TOPICS.IAM], fromBeginning: true });
      // 26/10/2026: giu promise message dang xu ly - backfillInBackground() doi no xong sau khi pause.
      await consumer.run({
        eachMessage: ({ message }) => {
          const handled = this.handleMessage(message.value);
          this.inFlight = handled.catch(() => undefined);
          return handled;
        },
      });
      this.logger.log(`Da ket noi Kafka consumer (group=${KAFKA_CONSUMER_GROUPS.DOCUMENT_SERVICE})`);
    } catch (err) {
      this.logger.error(`Khoi dong Kafka consumer that bai: ${(err as Error).message}`);
      this.scheduleConsumerRestart();
    }
  }

  /**
   * JSON hong/thieu truong hoac loi du lieu vinh vien (vd id khong phai UUID) -> bo qua (log). Loi
   * tam thoi (mat ket noi DB...) -> nem lai de kafkajs giao lai message, khong mat su kien.
   */
  async handleMessage(value: Buffer | null): Promise<void> {
    if (!value) return;
    let event: DomainEvent;
    try {
      event = JSON.parse(value.toString()) as DomainEvent;
    } catch {
      this.logger.warn('Bo qua message Kafka khong phai JSON hop le');
      return;
    }
    if (!event || typeof event.eventType !== 'string' || typeof event.organizationId !== 'string') return;
    try {
      await this.projectScopeService.applyEvent(event);
    } catch (err) {
      if (!isPermanentDataError(err)) throw err;
      this.logger.warn(`Bo qua su kien loi du lieu (eventType=${event.eventType}, eventId=${event.eventId}): ${(err as Error).message}`);
    }
  }

  private scheduleConsumerRestart(): void {
    if (this.destroyed) return;
    const previous = this.consumer;
    this.consumer = undefined;
    void previous?.disconnect().catch(() => undefined);
    this.timer = setTimeout(() => void this.startConsumer(), CONSUMER_RESTART_DELAY_MS);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.wake = resolve;
      this.timer = setTimeout(resolve, ms);
    });
  }
}
