import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { EventType } from '@app/common-dto';

/**
 * Ghi 1 ban ghi outbox_events trong CUNG transaction voi thay doi nghiep vu.
 * Goi ben trong `dataSource.transaction(async (manager) => { ... })` cua service nghiep vu.
 * Sao chep tu apps/iam-service/src/outbox/outbox.service.ts (file mau tham chieu).
 */
@Injectable()
export class OutboxService {
  async record(
    manager: EntityManager,
    params: {
      eventType: EventType | string;
      organizationId: string;
      producer: string;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    const outbox = manager.create(OutboxEvent, {
      eventId: uuidv4(),
      eventType: params.eventType,
      organizationId: params.organizationId,
      producer: params.producer,
      payload: params.payload,
      occurredAt: new Date(),
      published: false,
    });
    await manager.save(outbox);
  }
}
