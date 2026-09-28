import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { ConversationType } from './conversation-type.enum';

/** Cuoc tro chuyen 1:1 (DIRECT) hoac nhom/kenh (GROUP) giua cac thanh vien cung to chuc. */
@Entity('conversations')
export class Conversation extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'enum', enum: ConversationType })
  type: ConversationType;

  // 05/08/2026 (bai hoc tu Customer.email, xem customer.entity.ts): khai bao type: 'varchar' tuong
  // minh - union `string | null` bi erase thanh Object qua reflect-metadata, TypeORM se nem
  // DataTypeNotSupportedError luc khoi dong neu thieu.
  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  // Nguoi tao cuoc tro chuyen - CHI la userId (khong luu ten/email, xem chu thich app.module.ts).
  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;
}
