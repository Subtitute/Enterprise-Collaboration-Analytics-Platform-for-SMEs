import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { bigintTransformer } from '../common/bigint.transformer';
import { FileMeta } from './file-meta.entity';

/**
 * Lich su phien ban cua 1 file - Technical_Spec.md muc 3.4 (versioning don gian, giu toi
 * da N ban gan nhat). Chinh sach retention (MAX_FILE_VERSIONS = 5) ap dung o FilesService.
 */
@Entity('file_versions')
// 22/07/2026: Fix 2 (code review, phong thu chieu sau/defense-in-depth) - rang buoc unique
// (fileId, versionNumber) O TANG DATABASE, cung dinh dang voi @Unique(['fileId','sharedWithUserId'])
// tren FileShare/@Unique(['taskId','userId']) tren TaskAssignee (project-task-service) da co san
// trong repo. Khoa pessimistic_write o FilesService.uploadNewVersion() da chan duoc race condition
// o TANG UNG DUNG, nhung rang buoc nay la lop bao ve THU 2 doc lap voi tang do: neu trong tuong
// lai co code path khac ghi FileVersion ma KHONG di qua khoa (vd script/job noi bo), DB se TU CHOI
// thay vi am tham chap nhan 2 phien ban trung so. Service nay dung `synchronize: true` (xem
// app.module.ts), khong dung migration thu cong, nen decorator nay se tu ap dung vao schema.
@Unique(['fileId', 'versionNumber'])
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
