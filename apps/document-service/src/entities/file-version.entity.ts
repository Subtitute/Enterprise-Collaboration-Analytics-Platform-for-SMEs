import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { bigintTransformer } from '../common/bigint.transformer';
import { FileMeta } from './file-meta.entity';

/**
 * Lich su phien ban cua 1 file - Technical_Spec.md muc 3.4 (versioning don gian, giu toi
 * da N ban gan nhat). Chinh sach retention (MAX_FILE_VERSIONS = 5) ap dung o FilesService.
 */
@Entity('file_versions')
export class FileVersion extends AppBaseEntity {
  @Index()
  @Column({ name: 'file_id', type: 'uuid' })
  fileId: string;

  @ManyToOne(() => FileMeta, (file) => file.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file: FileMeta;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({ name: 'object_key' })
  objectKey: string;

  @Column({ name: 'size_bytes', type: 'bigint', transformer: bigintTransformer })
  sizeBytes: number;

  @Column({ name: 'uploaded_by_user_id', type: 'uuid' })
  uploadedByUserId: string;
}
