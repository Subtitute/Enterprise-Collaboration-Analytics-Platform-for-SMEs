import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Folder } from '../entities/folder.entity';
import { FileMeta } from '../entities/file-meta.entity';
import { FileVersion } from '../entities/file-version.entity';
// 28/07/2026: entity + provider moi - kiem soat truy cap thu muc (opt-in). `FolderAccessService`
// duoc export de FilesModule dung chung (xem files.module.ts) - tranh lap lai logic
// canAccessFolder o 2 noi.
import { FolderShare } from '../entities/folder-share.entity';
import { FolderAccessService } from './folder-access.service';
import { FoldersService } from './folders.service';
import { FoldersController } from './folders.controller';
import { OutboxModule } from '../outbox/outbox.module';
// 26/10/2026: read-model du an cho tai lieu theo pham vi du an (FolderAccessService/FoldersService).
import { ProjectRef } from '../entities/project-ref.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Folder, FileMeta, FileVersion, FolderShare, ProjectRef]), OutboxModule],
  providers: [FoldersService, FolderAccessService],
  controllers: [FoldersController],
  exports: [FolderAccessService],
})
export class FoldersModule {}
