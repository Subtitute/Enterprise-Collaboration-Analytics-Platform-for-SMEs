import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Folder } from '../entities/folder.entity';
import { FileMeta } from '../entities/file-meta.entity';
import { FileVersion } from '../entities/file-version.entity';
import { FoldersService } from './folders.service';
import { FoldersController } from './folders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Folder, FileMeta, FileVersion])],
  providers: [FoldersService],
  controllers: [FoldersController],
})
export class FoldersModule {}
