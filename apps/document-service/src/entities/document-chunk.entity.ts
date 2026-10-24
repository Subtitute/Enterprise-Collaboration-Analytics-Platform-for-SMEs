import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { FileMeta } from './file-meta.entity';

/**
 * 24/10/2026: 1 doan van ban (chunk) da nhung (embedding) cua 1 file tai lieu - phuc vu RAG cho
 * Chat bot noi bo (Technical_Spec.md muc 23). Tao/thay the boi DocumentIndexerService
 * (rag/document-indexer.service.ts), doc boi DocumentSearchService.
 *
 * `embedding` luu dang mang `real[]` thuan cua Postgres (KHONG dung pgvector - khong them extension/
 * container moi, tai nguyen Docker han che), vector da chuan hoa L2 luc ghi. Tim kiem la cosine
 * brute-force trong ung dung SAU KHI da loc theo quyen truy cap file - chap nhan duoc o quy mo du
 * lieu demo (vai tram tai lieu), xem gioi han tai DocumentSearchService.
 *
 * `onDelete: CASCADE` tren fileId: xoa file (FilesService.remove) hoac xoa thu muc chua file
 * (FoldersService.remove - xoa tuong minh tung FileMeta) deu tu dong xoa sach chunk o tang DB, khong
 * can code don dep rieng.
 */
@Entity('document_chunks')
@Index(['organizationId', 'fileId'])
export class DocumentChunk extends AppBaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Index()
  @Column({ name: 'file_id', type: 'uuid' })
  fileId: string;

  @ManyToOne(() => FileMeta, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id' })
  file?: FileMeta;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'real', array: true })
  embedding: number[];
}
