import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

/** Outbox Pattern - Technical_Spec.md muc 4.1. Ghi trong CUNG transaction voi thay doi nghiep vu. */
@Entity('outbox_events')
export class OutboxEvent extends AppBaseEntity {
  @Column({ name: 'event_id', unique: true })
  eventId: string;

  @Column({ name: 'event_type' })
  eventType: string;

  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column()
  producer: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Index()
  @Column({ default: false })
  published: boolean;
}
