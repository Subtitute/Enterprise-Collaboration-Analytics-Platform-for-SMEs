import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

// 28/07/2026: enum moi - kiem soat truy cap thu muc opt-in (yeu cau nhiem vu). Mac dinh
// ORGANIZATION giu nguyen hanh vi cu (moi thanh vien to chuc deu xem duoc) cho MOI thu muc da
// ton tai LAN thu muc moi tao - chi ai do CHU DONG doi sang RESTRICTED (qua PATCH /folders/:id)
// moi kich hoat han che, dung tinh chat "opt-in" nhu yeu cau.
export enum FolderVisibility {
  ORGANIZATION = 'organization',
  RESTRICTED = 'restricted',
}

/**
 * Cay thu muc tai lieu - Technical_Spec.md muc 3.4, muc 5 ("Folder 1-N Folder (cay thu muc)").
 * `parentFolderId` null = thu muc goc cua to chuc.
 */
@Entity('folders')
export class Folder extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'parent_folder_id', type: 'uuid', nullable: true })
  parentFolderId?: string | null;

  @ManyToOne(() => Folder, (folder) => folder.children, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_folder_id' })
  parentFolder?: Folder | null;

  @OneToMany(() => Folder, (folder) => folder.parentFolder)
  children: Folder[];

  @Column()
  name: string;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  // 28/07/2026: cot moi - kiem soat truy cap thu muc opt-in (xem FolderVisibility o tren va
  // FolderAccessService.canAccessFolder trong folders/folder-access.service.ts). `default:
  // ORGANIZATION` la yeu to lam cho tinh nang nay "opt-in" o tang DB: voi `synchronize: true`,
  // Postgres se tu dien gia tri nay cho MOI dong Folder DA TON TAI khi cot duoc them vao, nen
  // khong co thu muc cu nao bi "am tham" chuyen sang han che truy cap.
  @Column({ type: 'enum', enum: FolderVisibility, default: FolderVisibility.ORGANIZATION })
  visibility: FolderVisibility;

  // 26/10/2026: tai lieu theo pham vi du an - CHI thu muc cap goc gan duoc du an, thu muc con/tep
  // ke thua qua chuoi thu muc cha (resolveFolderAccess). NULL + ORGANIZATION = thu muc toan cong ty
  // (chinh sach, so tay...). Cot moi nullable nen moi thu muc cu tu dong la NULL khi synchronize -
  // gan du an cho du lieu demo cu bang scripts/migrate-project-documents.js.
  @Index()
  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId?: string | null;
}
