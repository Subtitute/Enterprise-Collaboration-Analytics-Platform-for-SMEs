import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { FileMeta } from './file-meta.entity';

/**
 * Chia se file - Technical_Spec.md muc 3.4 ("FileMeta N-N User qua FileShare").
 *
 * QUAN TRONG (xem yeu cau nhiem vu): day KHONG phai co che kiem soat truy cap cung -
 * moi user trong cung to chuc da co the xem/tai bat ky file nao (org-wide visibility,
 * MVP). FileShare chi dung de (a) FE hien thi bo loc "Chia se voi toi" va (b) kich hoat
 * su kien `document.shared` cho Notification Service bao cho dung nguoi.
 */
export enum FileSharePermission {
  VIEW = 'VIEW',
  EDIT = 'EDIT',
}

@Entity('file_shares')
@Unique(['fileId', 'sharedWithUserId'])
export class FileShare extends AppBaseEntity {
  @Column({ name: 'file_id', type: 'uuid' })
  fileId: string;

  @ManyToOne(() => FileMeta, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file: FileMeta;

  @Column({ name: 'shared_with_user_id', type: 'uuid' })
  sharedWithUserId: string;

  @Column({ type: 'enum', enum: FileSharePermission, default: FileSharePermission.VIEW })
  permission: FileSharePermission;

  @Column({ name: 'shared_by_user_id', type: 'uuid' })
  sharedByUserId: string;
}
