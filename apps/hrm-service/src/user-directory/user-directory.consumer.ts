import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Consumer, Kafka } from 'kafkajs';
import { KAFKA_CONSUMER_GROUPS, KAFKA_TOPICS } from '@app/common-dto';
import { handleDirectoryMessage } from './user-directory';

/**
 * 26/10/2026: consumer DUY NHAT cua service nay - chi doc topic iam.events de duy tri dim_user
 * (xem user-directory.ts). fromBeginning: true de group moi doc lai toan bo lich su con giu trong
 * topic (gom ca dot phat lai departmentId luc IAM khoi dong). Khoi dong KHONG chan bootstrap: Kafka
 * tam thoi chua san sang thi service van phuc vu HTTP binh thuong, consumer tu thu lai voi backoff
 * (mirror registerCrashHandler()/restartWithBackoff() cua Analytics Service, rut gon).
 */
@Injectable()
export class UserDirectoryConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(UserDirectoryConsumer.name);
  private consumer?: Consumer;
  private restartTimer?: ReturnType<typeof setTimeout>;
  private restartAttempt = 0;
  private destroyed = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  onApplicationBootstrap(): void {
    void this.start();
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    await this.consumer?.disconnect().catch(() => undefined);
  }

  private async start(): Promise<void> {
    if (this.destroyed) return;
    try {
      const kafka = new Kafka({
        clientId: 'hrm-service-directory',
        brokers: [this.configService.get<string>('kafka.broker') ?? 'localhost:9092'],
        retry: { retries: 8 },
      });
      const consumer = kafka.consumer({ groupId: KAFKA_CONSUMER_GROUPS.HRM_SERVICE_DIRECTORY });
      this.consumer = consumer;
      consumer.on(consumer.events.CRASH, (event) => {
        this.logger.error(`Consumer dim_user CRASH: ${event.payload.error.message}`);
        if (!event.payload.restart) this.scheduleRestart();
      });
      await consumer.connect();
      await consumer.subscribe({ topics: [KAFKA_TOPICS.IAM], fromBeginning: true });
      await consumer.run({
        eachMessage: async ({ message }) => {
          await handleDirectoryMessage(this.dataSource, message.value);
        },
      });
      this.restartAttempt = 0;
      this.logger.log(`Da ket noi consumer dim_user (group=${KAFKA_CONSUMER_GROUPS.HRM_SERVICE_DIRECTORY})`);
    } catch (err) {
      this.logger.error(`Khoi dong consumer dim_user that bai: ${(err as Error).message}`);
      this.scheduleRestart();
    }
  }

  private scheduleRestart(): void {
    if (this.destroyed) return;
    this.restartAttempt += 1;
    const delayMs = Math.min(30_000, 1000 * 2 ** this.restartAttempt);
    const previous = this.consumer;
    this.consumer = undefined;
    void previous?.disconnect().catch(() => undefined);
    this.restartTimer = setTimeout(() => void this.start(), delayMs);
  }
}
