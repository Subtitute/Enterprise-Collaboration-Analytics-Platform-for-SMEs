import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Folder } from '../entities/folder.entity';
import { FileMeta } from '../entities/file-meta.entity';
import { FileVersion } from '../entities/file-version.entity';
import { FoldersService } from './folders.service';
import { FoldersController } from './folders.controller';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [TypeOrmModule.forFeature([Folder, FileMeta, FileVersion]), OutboxModule],
  providers: [FoldersService],
  controllers: [FoldersController],
})
export class FoldersModule {}
