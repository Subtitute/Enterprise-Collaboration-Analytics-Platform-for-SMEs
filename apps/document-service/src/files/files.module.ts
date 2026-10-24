import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileMeta } from '../entities/file-meta.entity';
import { FileVersion } from '../entities/file-version.entity';
import { FileShare } from '../entities/file-share.entity';
import { Folder } from '../entities/folder.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { OutboxModule } from '../outbox/outbox.module';
// 28/07/2026: import FoldersModule de dung FolderAccessService (canAccessFolder) dung chung -
// kiem soat truy cap thu muc, opt-in. Mot chieu: FilesModule -> FoldersModule, FoldersModule
// khong biet gi ve FilesModule nen khong tao phu thuoc vong.
import { FoldersModule } from '../folders/folders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileMeta, FileVersion, FileShare, Folder]),
    OutboxModule,
    FoldersModule,
  ],
  providers: [FilesService],
  controllers: [FilesController],
  // 24/10/2026: export cho RagModule dung chung FilesService.canAccessFile() - xem rag/rag.module.ts.
  exports: [FilesService],
})
export class FilesModule {}
