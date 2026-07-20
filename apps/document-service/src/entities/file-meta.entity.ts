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

  @OneToMany(() => FileVersion, (version) => version.file)
  versions: FileVersion[];
}
