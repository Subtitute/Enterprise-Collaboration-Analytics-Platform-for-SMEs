import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { User } from './user.entity';

/**
 * id cua ban ghi nay CHINH LA tokenId nhung trong JwtRefreshPayload.
 * Ton tai trong bang nay = con hieu luc; xoa/het han = thu hoi.
 * Technical_Spec.md muc 6: "refresh token... co the thu hoi qua Redis blacklist"
 * -> Postgres la nguon su that ve phien, Redis la cache blacklist nhanh (xem RedisService).
 */
@Entity('refresh_tokens')
export class RefreshToken extends AppBaseEntity {
  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
