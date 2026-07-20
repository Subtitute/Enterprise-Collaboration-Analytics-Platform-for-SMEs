import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { FileMeta } from '../entities/file-meta.entity';
import { FileVersion } from '../entities/file-version.entity';
import { FileShare } from '../entities/file-share.entity';
import { Folder } from '../entities/folder.entity';
import { OutboxService } from '../outbox/outbox.service';
import { MinioService } from '../minio/minio.service';
import { ShareFileDto } from './dto/share-file.dto';
import { buildObjectKey } from './utils/object-key.util';
import { MAX_FILE_VERSIONS, pruneOldVersions } from './utils/version-retention.util';
import {
  DocumentDeletedPayload,
  DocumentSharedPayload,
  DocumentUploadedPayload,
  EVENT_TYPES,
  PaginatedResponse,
  PaginationQueryDto,
  paginate,
} from '@app/common-dto';

const PRODUCER = 'document-service';

/**
 * CRUD File - Technical_Spec.md muc 3.4, Wireframe.md muc 5.
 *
 * Ghi chu ve access model (MVP - xem yeu cau nhiem vu, KHONG over-engineer per-file ACL):
 * moi user da xac thuc trong CUNG to chuc co the xem/tai bat ky file nao (org-wide
 * visibility). `FileShare` chi dung de FE loc "Chia se voi toi" va kich hoat su kien
 * `document.shared` cho Notification Service - KHONG phai co che chan truy cap.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(FileMeta) private readonly fileMetaRepo: Repository<FileMeta>,
    @InjectRepository(FileVersion) private readonly fileVersionRepo: Repository<FileVersion>,
    @InjectRepository(Folder) private readonly folderRepo: Repository<Folder>,
    private readonly outboxService: OutboxService,
    private readonly minioService: MinioService,
  ) {}

  async findAll(
    organizationId: string,
    folderId: string | undefined,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<FileMeta>> {
    const [data, total] = await this.fileMetaRepo.findAndCount({
      where: { organizationId, folderId: folderId ? folderId : IsNull() },
      order: { updatedAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(organizationId: string, id: string): Promise<FileMeta & { versions: FileVersion[] }> {
    const fileMeta = await this.fileMetaRepo.findOne({ where: { id, organizationId } });
    if (!fileMeta) throw new NotFoundException('Khong tim thay file');
    const versions = await this.fileVersionRepo.find({
      where: { fileId: id },
      order: { versionNumber: 'DESC' },
    });
    return { ...fileMeta, versions };
  }

  async getDownloadUrl(organizationId: string, id: string): Promise<{ downloadUrl: string }> {
    const fileMeta = await this.fileMetaRepo.findOne({ where: { id, organizationId } });
    if (!fileMeta) throw new NotFoundException('Khong tim thay file');
    const downloadUrl = await this.minioService.presignedGetObject(fileMeta.objectKey, 900);
    return { downloadUrl };
  }

  async upload(
    organizationId: string,
    actorId: string,
    folderId: string | null,
    file: Express.Multer.File,
  ): Promise<FileMeta> {
    if (folderId) {
      const folder = await this.folderRepo.findOne({ where: { id: folderId, organizationId } });
      if (!folder) throw new NotFoundException('Khong tim thay thu muc');
    }

    const fileId = uuidv4();
    const versionNumber = 1;
    const objectKey = buildObjectKey(organizationId, fileId, versionNumber, file.originalname);

    // Ghi noi dung nhi phan len MinIO TRUOC khi commit metadata: neu that bai giua chung,
    // ket qua xau nhat la 1 object "mo coi" tren MinIO (chap nhan duoc trong MVP), khong
    // bao gio de lai 1 dong FileMeta tro toi object khong ton tai.
    await this.minioService.putObject(objectKey, file.buffer, file.size, file.mimetype);

    return this.dataSource.transaction(async (manager) => {
      const fileMeta = await manager.save(
        manager.create(FileMeta, {
          id: fileId,
          organizationId,
          folderId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          objectKey,
          currentVersion: versionNumber,
          uploadedByUserId: actorId,
        }),
      );

      await manager.save(
        manager.create(FileVersion, {
          fileId: fileMeta.id,
          versionNumber,
          objectKey,
          sizeBytes: file.size,
          uploadedByUserId: actorId,
        }),
      );

      const payload: DocumentUploadedPayload = {
        fileId: fileMeta.id,
        folderId: folderId ?? null,
        fileName: fileMeta.fileName,
        actorId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.DOCUMENT_UPLOADED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return fileMeta;
    });
  }

  /** Tai len 1 phien ban moi cho file da ton tai. Khong phat su kien - chi `document.uploaded` cho lan dau. */
  async uploadNewVersion(
    organizationId: string,
    actorId: string,
    fileId: string,
    file: Express.Multer.File,
  ): Promise<FileMeta> {
    const fileMeta = await this.fileMetaRepo.findOne({ where: { id: fileId, organizationId } });
    if (!fileMeta) throw new NotFoundException('Khong tim thay file');

    const versionNumber = fileMeta.currentVersion + 1;
    const objectKey = buildObjectKey(organizationId, fileId, versionNumber, file.originalname);

    await this.minioService.putObject(objectKey, file.buffer, file.size, file.mimetype);

    const { updated, versionsToDelete } = await this.dataSource.transaction(async (manager) => {
      await manager.save(
        manager.create(FileVersion, {
          fileId,
          versionNumber,
          objectKey,
          sizeBytes: file.size,
          uploadedByUserId: actorId,
        }),
      );

      fileMeta.fileName = file.originalname;
      fileMeta.mimeType = file.mimetype;
      fileMeta.sizeBytes = file.size;
      fileMeta.objectKey = objectKey;
      fileMeta.currentVersion = versionNumber;
      const updated = await manager.save(fileMeta);

      // Chinh sach retention: giu toi da MAX_FILE_VERSIONS ban gan nhat (Technical_Spec.md muc 3.4).
      const allVersions = await manager.find(FileVersion, {
        where: { fileId },
        order: { versionNumber: 'ASC' },
      });
      const versionsToDelete = pruneOldVersions(allVersions, MAX_FILE_VERSIONS);
      if (versionsToDelete.length > 0) {
        await manager.remove(versionsToDelete);
      }

      return { updated, versionsToDelete };
    });

    for (const version of versionsToDelete) {
      await this.minioService
        .removeObject(version.objectKey)
        .catch((err) => this.logger.warn(`Khong the xoa object MinIO ${version.objectKey}: ${err}`));
    }

    return updated;
  }

  async share(
    organizationId: string,
    actorId: string,
    fileId: string,
    dto: ShareFileDto,
  ): Promise<FileShare> {
    const fileMeta = await this.fileMetaRepo.findOne({ where: { id: fileId, organizationId } });
    if (!fileMeta) throw new NotFoundException('Khong tim thay file');

    return this.dataSource.transaction(async (manager) => {
      let share = await manager.findOne(FileShare, {
        where: { fileId, sharedWithUserId: dto.sharedWithUserId },
      });
      if (share) {
        share.permission = dto.permission;
        share.sharedByUserId = actorId;
      } else {
        share = manager.create(FileShare, {
          fileId,
          sharedWithUserId: dto.sharedWithUserId,
          permission: dto.permission,
          sharedByUserId: actorId,
        });
      }
      const saved = await manager.save(share);

      const payload: DocumentSharedPayload = {
        fileId,
        sharedWithUserId: dto.sharedWithUserId,
        actorId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.DOCUMENT_SHARED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return saved;
    });
  }

  async remove(organizationId: string, actorId: string, id: string): Promise<void> {
    const fileMeta = await this.fileMetaRepo.findOne({ where: { id, organizationId } });
    if (!fileMeta) throw new NotFoundException('Khong tim thay file');

    const versions = await this.fileVersionRepo.find({ where: { fileId: id } });

    await this.dataSource.transaction(async (manager) => {
      // Cascade xoa FileVersion + FileShare o tang DB (onDelete: CASCADE tren ca 2 entity).
      await manager.remove(fileMeta);

      const payload: DocumentDeletedPayload = { fileId: id, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.DOCUMENT_DELETED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });
    });

    for (const version of versions) {
      await this.minioService
        .removeObject(version.objectKey)
        .catch((err) => this.logger.warn(`Khong the xoa object MinIO ${version.objectKey}: ${err}`));
    }
  }
}
