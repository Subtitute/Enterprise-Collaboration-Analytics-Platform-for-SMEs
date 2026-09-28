import { Column, Entity, Index, Unique } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

/**
 * Thanh vien cua 1 cuoc tro chuyen. Chi luu userId (string) - KHONG cache ten/email nguoi dung
 * (xem chu thich app.module.ts). `joinedAt` la ten field nghiep vu duoc dat rieng (tach khoi
 * `createdAt` ke thua tu AppBaseEntity) vi day la thoi diem THAM GIA cuoc tro chuyen, khac voi
 * "ban ghi participant nay duoc tao luc nao" ve mat ky thuat - 2 gia tri trung nhau luc tao moi
 * nhung se khac nhau neu sau nay bo sung tinh nang sua/khoi phuc ban ghi participant.
 */
@Entity('conversation_participants')
@Unique(['conversationId', 'userId'])
export class ConversationParticipant extends AppBaseEntity {
  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'joined_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  joinedAt: Date;

  // Dung de tinh unreadCount (GET /conversations) - null nghia la chua doc tin nhan nao.
  @Column({ name: 'last_read_at', type: 'timestamptz', nullable: true })
  lastReadAt?: Date | null;
}
