import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { FileMeta } from './file-meta.entity';

/**
 * Chia se file - Technical_Spec.md muc 3.4 ("FileMeta N-N User qua FileShare").
 *
 * QUAN TRONG (xem yeu cau nhiem vu): rieng voi file o cap ROOT (`folderId` null) hoac nam trong 1
 * thu muc `visibility = ORGANIZATION`, day VAN KHONG phai co che kiem soat truy cap - moi user
 * trong cung to chuc da co the xem/tai duoc (org-wide visibility, MVP), FileShare chi dung de (a)
 * FE hien thi bo loc "Chia se voi toi" va (b) kich hoat su kien `document.shared` cho Notification
 * Service bao cho dung nguoi.
 *
 * 28/07/2026: rieng voi file nam trong 1 thu muc `visibility = RESTRICTED` MA nguoi goi khong the
 * duyet thu muc do (khong phai nguoi tao/Org Admin/khong co FolderShare khop), 1 dong FileShare
 * khop TRUC TIEP voi file nay tro thanh co che chan truy cap THUC SU - "duong link rieng toi 1
 * file don le" (xem FilesService.canAccessFile). Bo sung `sharedWithDepartmentId` (nullable, chia
 * se theo PHONG BAN thay vi 1 user don) - vi vay `sharedWithUserId` cung duoc doi thanh nullable
 * (dung CHINH XAC 1 trong 2 cot, kiem tra o FilesService.share()).
 */
export enum FileSharePermission {
  VIEW = 'VIEW',
  EDIT = 'EDIT',
}

// 28/07/2026: GIU NGUYEN constraint nay du `sharedWithUserId` gio nullable - da kiem chung bang
// unit test (files.service.spec.ts, "cho phep 2 dong FileShare cung fileId voi sharedWithUserId
// deu NULL"): Postgres coi MOI gia tri NULL la PHAN BIET trong 1 unique constraint (khac SQL
// standard cu/MySQL), nen nhieu dong FileShare CUNG fileId nhung sharedWithUserId=NULL (tuc cac
// dong chia se theo PHONG BAN) khong bao gio dung cham constraint nay - no chi con tac dung dung
// cho truong hop cu (chia se theo user): 1 file khong the co 2 dong FileShare cho CUNG 1
// sharedWithUserId.
@Entity('file_shares')
@Unique(['fileId', 'sharedWithUserId'])
export class FileShare extends AppBaseEntity {
  @Column({ name: 'file_id', type: 'uuid' })
  fileId: string;

  @ManyToOne(() => FileMeta, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file: FileMeta;

  // 28/07/2026: chuyen thanh nullable - xem giai thich o docblock entity o tren.
  @Column({ name: 'shared_with_user_id', type: 'uuid', nullable: true })
  sharedWithUserId: string | null;

  // 28/07/2026: cot moi - chia se file theo PHONG BAN (dung song song voi FolderShare).
  @Column({ name: 'shared_with_department_id', type: 'uuid', nullable: true })
  sharedWithDepartmentId: string | null;

  @Column({ type: 'enum', enum: FileSharePermission, default: FileSharePermission.VIEW })
  permission: FileSharePermission;

  @Column({ name: 'shared_by_user_id', type: 'uuid' })
  sharedByUserId: string;
}
