import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DealStage } from '@app/common-dto';
import { AppBaseEntity } from '../common/base.entity';
import { Customer } from './customer.entity';

/** Co hoi ban hang (deal pipeline, Kanban) - Technical_Spec.md muc 16, Wireframe.md muc 12. */
@Entity('deals')
export class Deal extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Index()
  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.deals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column()
  title: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  value: number;

  @Column({ type: 'enum', enum: DealStage, default: DealStage.NEW })
  stage: DealStage;

  @Column({ name: 'expected_close_date', type: 'timestamptz', nullable: true })
  expectedCloseDate?: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt?: Date | null;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId: string;
}
