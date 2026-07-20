import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Folder } from '../entities/folder.entity';
import { FileMeta } from '../entities/file-meta.entity';
import { FileVersion } from '../entities/file-version.entity';
import { MinioService } from '../minio/minio.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

/** CRUD Folder (cay thu muc) - Technical_Spec.md muc 3.4, Wireframe.md muc 5. */
@Injectable()
export class FoldersService {
  private readonly logger = new Logger(FoldersService.name);

  constructor(
    @InjectRepository(Folder) private readonly folderRepo: Repository<Folder>,
    @InjectRepository(FileMeta) private readonly fileMetaRepo: Repository<FileMeta>,
    @InjectRepository(FileVersion) private readonly fileVersionRepo: Repository<FileVersion>,
    private readonly minioService: MinioService,
  ) {}

  findAll(organizationId: string, parentFolderId?: string): Promise<Folder[]> {
    return this.folderRepo.find({
      where: { organizationId, parentFolderId: parentFolderId ? parentFolderId : IsNull() },
      order: { name: 'ASC' },
    });
  }

  async create(organizationId: string, actorId: string, dto: CreateFolderDto): Promise<Folder> {
    if (dto.parentFolderId) {
      const parent = await this.folderRepo.findOne({
        where: { id: dto.parentFolderId, organizationId },
      });
      if (!parent) throw new NotFoundException('Khong tim thay thu muc cha');
    }
    const folder = this.folderRepo.create({
      organizationId,
      parentFolderId: dto.parentFolderId ?? null,
      name: dto.name,
      createdByUserId: actorId,
    });
    return this.folderRepo.save(folder);
  }

  async update(organizationId: string, id: string, dto: UpdateFolderDto): Promise<Folder> {
    const folder = await this.folderRepo.findOne({ where: { id, organizationId } });
    if (!folder) throw new NotFoundException('Khong tim thay thu muc');
    folder.name = dto.name;
    return this.folderRepo.save(folder);
  }

  /**
   * Xoa 1 thu muc va toan bo cay con.
   *
   * Luu y quan trong: `FileMeta.folderId` dung `onDelete: SET NULL` (khong phai CASCADE -
   * xem file-meta.entity.ts, dung cho truong hop 1 file duoc "day len root" khi thu muc
   * chua no bi xoa don le). Vi vay DB se KHONG tu xoa file khi ta xoa thu muc - o day PHAI
   * tu xu ly tuong minh truoc khi xoa thu muc:
   *   1. Tim toan bo Folder id thuoc cay con (BFS qua parentFolderId).
   *   2. Tim toan bo FileMeta thuoc cac thu muc do.
   *   3. Xoa object MinIO cua TAT CA phien ban cua cac file do (MinIO nam ngoai DB
   *      transaction/cascade - phai xoa tay).
   *   4. Xoa tuong minh cac dong FileMeta - luc nay DB moi cascade tiep FileVersion/
   *      FileShare (onDelete: CASCADE cua rieng chung).
   *   5. Xoa thu muc goc - DB tu cascade xoa toan bo thu muc con (Folder tu tham chieu
   *      onDelete: CASCADE), an toan vi khong con FileMeta nao ben trong cay nua.
   */
  async remove(organizationId: string, id: string): Promise<void> {
    const folder = await this.folderRepo.findOne({ where: { id, organizationId } });
    if (!folder) throw new NotFoundException('Khong tim thay thu muc');

    const folderIds = await this.collectFolderTreeIds(organizationId, id);
    const files = await this.fileMetaRepo.find({ where: { folderId: In(folderIds) } });

    if (files.length > 0) {
      const fileIds = files.map((f) => f.id);
      const versions = await this.fileVersionRepo.find({ where: { fileId: In(fileIds) } });
      for (const version of versions) {
        await this.minioService
          .removeObject(version.objectKey)
          .catch((err) => this.logger.warn(`Khong the xoa object MinIO ${version.objectKey}: ${err}`));
      }
      await this.fileMetaRepo.remove(files);
    }

    await this.folderRepo.remove(folder);
  }

  private async collectFolderTreeIds(organizationId: string, rootId: string): Promise<string[]> {
    const ids = [rootId];
    let frontier = [rootId];
    while (frontier.length > 0) {
      const children = await this.folderRepo.find({
        where: { organizationId, parentFolderId: In(frontier) },
      });
      if (children.length === 0) break;
      const childIds = children.map((c) => c.id);
      ids.push(...childIds);
      frontier = childIds;
    }
    return ids;
  }
}
