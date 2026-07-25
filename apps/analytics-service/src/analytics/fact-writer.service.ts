import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DomainEvent } from '@app/common-dto';

/**
 * 25/07/2026 (Fix 2 - Major, audit): kieu dung chung cho tham so `runner` cua tung ham ghi o
 * duoi - cho phep goi qua DataSource (mac dinh, khi ghi doc lap ngoai transaction) HOAC qua
 * EntityManager cua 1 transaction Postgres dang mo (`dataSource.transaction(async (manager) =>
 * ...)`, xem KafkaConsumerService.handleEvent()) ma khong can 2 overload rieng - ca DataSource
 * lan EntityManager cua TypeORM deu co phuong thuc `query(sql, params)` cung chu ky.
 */
type QueryExecutor = Pick<DataSource, 'query'>;

/**
 * Ghi du lieu tho tu Kafka event vao 3 hypertable cua TimescaleDB (infra/timescale-init/001-init.sql).
 * Dung raw SQL tham so hoa qua DataSource.query - KHONG dung TypeORM entity/repository vi hypertable
 * khong map duoc vao ORM entity model (xem ghi chu trong app.module.ts).
 *
 * Moi INSERT deu dung `ON CONFLICT (time, event_id) DO NOTHING` de idempotent theo eventId: neu
 * OutboxPublisherJob phia producer publish trung 1 message (Technical_Spec.md muc 4.1 - gioi han
 * da biet), ban ghi thu 2 se bi bo qua thay vi tao du lieu trung lap trong bao cao KPI.
 *
 * 22/07/2026: cac ham o day KHONG tu bat loi Postgres (khong try/catch) - moi loi (tam thoi
 * hay vinh vien/du lieu sai) deu duoc de nguyen bubble len cho KafkaConsumerService.handleEvent()
 * phan loai va quyet dinh rethrow (retry) hay log-and-skip (poison pill), giu dung 1 noi duy
 * nhat so huu chinh sach retry/skip thay vi rai rac o ca 2 lop (xem kafka-consumer.service.ts).
 *
 * 25/07/2026 (Fix 2 - Major, audit): tung ham nhan them tham so `runner` TUY CHON, mac dinh la
 * `this.dataSource` (giu nguyen hanh vi cu khi goi doc lap). KafkaConsumerService.handleEvent()
 * gio boc nhieu loi goi lien tiep (vd recordUserActivity() + recordTaskEvent()) cho CUNG 1 event
 * trong 1 transaction DUY NHAT bang cach truyen EntityManager cua transaction do lam `runner` -
 * xem ghi chu chi tiet trong kafka-consumer.service.ts ve loi WebSocket push bi mat vinh vien ma
 * fix nay xu ly.
 */
@Injectable()
export class FactWriterService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Luon ghi - phuc vu feed "Hoat dong gan day" (GET /analytics/recent-activity).
   *
   * 22/07/2026: them `RETURNING event_id` va tra ve boolean (co ghi duoc dong MOI hay khong)
   * de KafkaConsumerService.handleEvent() biet duoc day co phai lan XU LY DAU TIEN cua eventId
   * nay hay khong. Truoc fix nay ham tra ve void nen consumer luon goi emitActivity() ke ca khi
   * `ON CONFLICT DO NOTHING` da am tham bo qua 1 ban ghi trung (OutboxPublisherJob phia producer
   * publish lai cung 1 event - Technical_Spec.md muc 4.1) - lam WebSocket push mat idempotent
   * trong khi du lieu da luu (fact table) van dung, khac voi notifications.service.ts (Mongo)
   * da xu ly dung truong hop nay tu truoc.
   *
   * 25/07/2026 (Fix 2 - Major, audit): them tham so `runner` tuy chon (mac dinh `this.dataSource`)
   * - xem ghi chu Fix 2 o dau file. KafkaConsumerService truyen EntityManager cua 1 transaction
   * dang mo vao day khi can gop ham nay voi recordTaskEvent()/recordDocumentEvent() thanh 1 don
   * vi atomic cho cung 1 event.
   */
  async recordUserActivity(event: DomainEvent, runner: QueryExecutor = this.dataSource): Promise<boolean> {
    const rows = await runner.query(
      `
      INSERT INTO fact_user_activity (time, event_id, organization_id, event_type, producer, actor_id, payload)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (time, event_id) DO NOTHING
      RETURNING event_id
      `,
      [
        event.occurredAt,
        event.eventId,
        event.organizationId,
        event.eventType,
        event.producer,
        extractString(event, 'actorId'),
        JSON.stringify(event.payload ?? {}),
      ],
    );
    return rows.length > 0;
  }

  /**
   * eventType bat dau bang "task." hoac "project." - Technical_Spec.md muc 4.3 (payload cac loai event).
   * 22/07/2026: tra ve boolean (co ghi duoc dong MOI hay khong) cung ly do nhu recordUserActivity() o tren.
   * 25/07/2026 (Fix 2 - Major, audit): them tham so `runner` tuy chon, cung ly do nhu recordUserActivity() o tren.
   */
  async recordTaskEvent(event: DomainEvent, runner: QueryExecutor = this.dataSource): Promise<boolean> {
    const rows = await runner.query(
      `
      INSERT INTO fact_task_events (time, event_id, organization_id, event_type, project_id, task_id, from_status, to_status, actor_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (time, event_id) DO NOTHING
      RETURNING event_id
      `,
      [
        event.occurredAt,
        event.eventId,
        event.organizationId,
        event.eventType,
        extractString(event, 'projectId'),
        extractString(event, 'taskId'),
        extractString(event, 'fromStatus'),
        extractString(event, 'toStatus'),
        extractString(event, 'actorId'),
      ],
    );
    return rows.length > 0;
  }

  /**
   * eventType bat dau bang "document."
   * 22/07/2026: tra ve boolean (co ghi duoc dong MOI hay khong) cung ly do nhu recordUserActivity() o tren.
   * 25/07/2026 (Fix 2 - Major, audit): them tham so `runner` tuy chon, cung ly do nhu recordUserActivity() o tren.
   */
  async recordDocumentEvent(event: DomainEvent, runner: QueryExecutor = this.dataSource): Promise<boolean> {
    const rows = await runner.query(
      `
      INSERT INTO fact_document_events (time, event_id, organization_id, event_type, file_id, folder_id, actor_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (time, event_id) DO NOTHING
      RETURNING event_id
      `,
      [
        event.occurredAt,
        event.eventId,
        event.organizationId,
        event.eventType,
        extractString(event, 'fileId'),
        extractString(event, 'folderId'),
        extractString(event, 'actorId'),
      ],
    );
    return rows.length > 0;
  }
}

/**
 * Lay 1 truong string tu payload neu co, tra ve null neu khong ton tai/khac kieu du lieu -
 * khong phai event nao cung co du moi truong (vd TaskCreatedPayload khong co fromStatus/toStatus).
 */
function extractString(event: DomainEvent, field: string): string | null {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const value = payload[field];
  return typeof value === 'string' ? value : null;
}
