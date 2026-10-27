import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { User } from './user.entity';

/**
 * 15/09/2026: "Quen mat khau" - mirror CHINH XAC pattern cua RefreshToken (cung file) da co san:
 * id cua ban ghi nay CHINH LA tokenId nhung trong JWT reset-password (ky rieng bang
 * jwt.resetSecret, KHAC voi access/refresh secret - phong khi 1 trong 2 secret kia bi lo thi
 * khong the gia mao duoc token reset mat khau va nguoc lai). Khac RefreshToken o cho: token nay
 * CHI DUNG DUOC 1 LAN (`usedAt`), khong xoay vong/khong phat lai. Postgres la nguon su that DUY
 * NHAT (khong can Redis blacklist nhu RefreshToken - token nay song rat ngan, thuong 30 phut, va
 * khong co khai niem "revoke som" nhu logout()).
 */
@Entity('password_reset_tokens')
export class PasswordResetToken extends AppBaseEntity {
  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  // 26/10/2026: INVITE = token kich hoat tai khoan duoc moi khong kem mat khau (han 72 gio, Technical_Spec.md
  // muc 27.9) - dung chung trang /reset-password va AuthService.resetPassword() voi RESET.
  @Column({ type: 'varchar', length: 16, default: 'RESET' })
  purpose: 'RESET' | 'INVITE';
}
