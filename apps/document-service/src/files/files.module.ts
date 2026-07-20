import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileMeta } from '../entities/file-meta.entity';
import { FileVersion } from '../entities/file-version.entity';
import { FileShare } from '../entities/file-share.entity';
import { Folder } from '../entities/folder.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileMeta, FileVersion, FileShare, Folder]),
    OutboxModule,
  ],
  providers: [FilesService],
  controllers: [FilesController],
})
export class FilesModule {}
