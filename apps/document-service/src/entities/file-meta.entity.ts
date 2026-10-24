import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { bigintTransformer } from '../common/bigint.transformer';
import { Folder } from './folder.entity';
import { FileVersion } from './file-version.entity';

/**
 * Metadata file tai lieu - noi dung nhi phan luu tai MinIO (chi luu `objectKey` tro toi
 * MinIO - Technical_Spec.md muc 5). `folderId` null = file o cap goc (root level).
 */
@Entity('file_metas')
export class FileMeta extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'folder_id', type: 'uuid', nullable: true })
  folderId?: string | null;

  @ManyToOne(() => Folder, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'folder_id' })
  folder?: Folder | null;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'bigint', transformer: bigintTransformer })
  sizeBytes: number;

  /** Object key MinIO cua phien ban HIEN TAI - quy uoc: `${organizationId}/${fileId}/v${versionNumber}/${originalFileName}`. */
  @Column({ name: 'object_key' })
  objectKey: string;

  @Column({ name: 'current_version', type: 'int', default: 1 })
  currentVersion: number;

  @Column({ name: 'uploaded_by_user_id', type: 'uuid' })
  uploadedByUserId: string;

  // 24/10/2026: RAG cho Chat bot noi bo - phien ban (currentVersion) DA duoc index xong (ke ca truong
  // hop "khong co gi de index": loai file khong ho tro/file rong). NULL hoac lech currentVersion =
  // can index lai - DocumentIndexerService quet dieu kien nay dinh ky, nen CUNG 1 co che phuc vu ca
  // file moi tai len, phien ban moi lan backfill file demo co san (cot moi = NULL cho moi dong cu).
  // `select: false`: khong lo ra API danh sach/chi tiet file; chi cap nhat qua SQL tho (khong qua
  // save()) de khong cham `updatedAt` - cot dung de sap xep danh sach file o FE.
  @Column({ name: 'rag_indexed_version', type: 'int', nullable: true, select: false })
  ragIndexedVersion?: number | null;

  // 24/10/2026: phien ban DANG duoc trich van ban cho RAG - DocumentIndexerService dat ngay TRUOC khi giao
  // noi dung cho unpdf/mammoth va xoa ngay sau do (ke ca khi loi). Con nguyen gia tri = lan trich truoc
  // cua CHINH phien ban nay lam chet process (OOM/crash) -> lan quet sau bo qua noi dung thay vi trich
  // lai (tranh vong lap crash-restart vo han). Cung quy uoc select: false + chi ghi bang SQL tho.
  @Column({ name: 'rag_extract_attempt_version', type: 'int', nullable: true, select: false })
  ragExtractAttemptVersion?: number | null;

  @OneToMany(() => FileVersion, (version) => version.file)
  versions: FileVersion[];
}
