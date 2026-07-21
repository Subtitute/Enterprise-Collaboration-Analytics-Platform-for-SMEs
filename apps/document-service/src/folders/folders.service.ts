import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Folder } from '../entities/folder.entity';
import { FileMeta } from '../entities/file-meta.entity';
import { FileVersion } from '../entities/file-version.entity';
import { MinioService } from '../minio/minio.service';
import { OutboxService } from '../outbox/outbox.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { DocumentDeletedPayload, EVENT_TYPES } from '@app/common-dto';

const PRODUCER = 'document-service';

/** CRUD Folder (cay thu muc) - Technical_Spec.md muc 3.4, Wireframe.md muc 5. */
@Injectable()
export class FoldersService {
  private readonly logger = new Logger(FoldersService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Folder) private readonly folderRepo: Repository<Folder>,
    @InjectRepository(FileMeta) private readonly fileMetaRepo: Repository<FileMeta>,
    @InjectRepository(FileVersion) private readonly fileVersionRepo: Repository<FileVersion>,
    private readonly minioService: MinioService,
    private readonly outboxService: OutboxService,
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
   *   2. Tim toan bo FileMeta (+ FileVersion cua chung) thuoc cac thu muc do.
   *   3. Trong 1 transaction DUY NHAT (giong pattern cua FilesService.remove()): xoa tuong
   *      minh cac dong FileMeta (DB cascade tiep FileVersion/FileShare qua onDelete: CASCADE
   *      cua rieng chung), xoa thu muc goc (DB tu cascade xoa toan bo thu muc con qua
   *      Folder tu tham chieu onDelete: CASCADE), VA ghi 1 outbox event `document.deleted`
   *      cho MOI file bi xoa - truoc ban sua loi nay, xoa ca thu muc chua file la thao tac
   *      "vo hinh" voi Analytics/consumer khac vi khong outbox event nao duoc phat.
   *   4. Sau khi transaction commit thanh cong: xoa object MinIO cua TAT CA phien ban cua
   *      cac file do - best-effort, khong the lam transactional xuyen he thong (MinIO nam
   *      ngoai DB transaction) - giong dung tradeoff da chap nhan o FilesService.remove()
   *      va Technical_Spec.md muc 14 (don dep object mo coi la gioi han da biet).
   */
  async remove(organizationId: string, actorId: string, id: string): Promise<void> {
    const folder = await this.folderRepo.findOne({ where: { id, organizationId } });
    if (!folder) throw new NotFoundException('Khong tim thay thu muc');

    const folderIds = await this.collectFolderTreeIds(organizationId, id);
    const files = await this.fileMetaRepo.find({ where: { folderId: In(folderIds) } });
    const fileIds = files.map((f) => f.id);
    const versions =
      fileIds.length > 0 ? await this.fileVersionRepo.find({ where: { fileId: In(fileIds) } }) : [];

    await this.dataSource.transaction(async (manager) => {
      if (files.length > 0) {
        // Cascade xoa FileVersion + FileShare o tang DB (onDelete: CASCADE tren ca 2 entity),
        // giong FilesService.remove().
        await manager.remove(files);

        for (const file of files) {
          const payload: DocumentDeletedPayload = { fileId: file.id, actorId };
          await this.outboxService.record(manager, {
            eventType: EVENT_TYPES.DOCUMENT_DELETED,
            organizationId,
            producer: PRODUCER,
            payload: payload as unknown as Record<string, unknown>,
          });
        }
      }

      await manager.remove(folder);
    });

    for (const version of versions) {
      await this.minioService
        .removeObject(version.objectKey)
        .catch((err) => this.logger.warn(`Khong the xoa object MinIO ${version.objectKey}: ${err}`));
    }
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
