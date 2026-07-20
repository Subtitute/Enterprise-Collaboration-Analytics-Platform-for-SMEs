import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DomainEvent } from '@app/common-dto';

/**
 * Ghi du lieu tho tu Kafka event vao 3 hypertable cua TimescaleDB (infra/timescale-init/001-init.sql).
 * Dung raw SQL tham so hoa qua DataSource.query - KHONG dung TypeORM entity/repository vi hypertable
 * khong map duoc vao ORM entity model (xem ghi chu trong app.module.ts).
 *
 * Moi INSERT deu dung `ON CONFLICT (time, event_id) DO NOTHING` de idempotent theo eventId: neu
 * OutboxPublisherJob phia producer publish trung 1 message (Technical_Spec.md muc 4.1 - gioi han
 * da biet), ban ghi thu 2 se bi bo qua thay vi tao du lieu trung lap trong bao cao KPI.
 */
@Injectable()
export class FactWriterService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Luon ghi - phuc vu feed "Hoat dong gan day" (GET /analytics/recent-activity). */
  async recordUserActivity(event: DomainEvent): Promise<void> {
    await this.dataSource.query(
      `
      INSERT INTO fact_user_activity (time, event_id, organization_id, event_type, producer, actor_id, payload)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (time, event_id) DO NOTHING
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
  }

  /** eventType bat dau bang "task." hoac "project." - Technical_Spec.md muc 4.3 (payload cac loai event). */
  async recordTaskEvent(event: DomainEvent): Promise<void> {
    await this.dataSource.query(
      `
      INSERT INTO fact_task_events (time, event_id, organization_id, event_type, project_id, task_id, from_status, to_status, actor_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (time, event_id) DO NOTHING
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
  }

  /** eventType bat dau bang "document." */
  async recordDocumentEvent(event: DomainEvent): Promise<void> {
    await this.dataSource.query(
      `
      INSERT INTO fact_document_events (time, event_id, organization_id, event_type, file_id, folder_id, actor_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (time, event_id) DO NOTHING
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
