import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

/** 1 tin nhan trong 1 cuoc tro chuyen. Xoa mem (deletedAt) - chi nguoi gui duoc xoa tin nhan cua minh. */
@Entity('messages')
export class Message extends AppBaseEntity {
  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  // CHI luu userId (khong cache ten/email) - xem chu thich app.module.ts.
  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
