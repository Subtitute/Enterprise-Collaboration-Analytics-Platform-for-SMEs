import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { FileMeta } from '../entities/file-meta.entity';
import { FilesModule } from '../files/files.module';
import { GeminiEmbeddingService } from './gemini-embedding.service';
import { DocumentIndexerService } from './document-indexer.service';
import { DocumentSearchService } from './document-search.service';
import { RagController } from './rag.controller';

// 24/10/2026: RAG tai lieu cho Chat bot noi bo (Technical_Spec.md muc 23). Phu thuoc 1 chieu
// RagModule -> FilesModule (dung FilesService.canAccessFile); FilesModule KHONG biet gi ve RAG - viec
// index chay nen qua quet dinh ky (DocumentIndexerService), khong goi tu duong upload.
// MinioService da @Global() (minio.module.ts) nen khong can import MinioModule.
@Module({
  imports: [TypeOrmModule.forFeature([DocumentChunk, FileMeta]), FilesModule],
  providers: [GeminiEmbeddingService, DocumentIndexerService, DocumentSearchService],
  controllers: [RagController],
})
export class RagModule {}
