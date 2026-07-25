import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { buildContentDisposition } from './utils/content-disposition.util';
import { MAX_FILE_VERSIONS, pruneOldVersions } from './utils/version-retention.util';
// 22/07/2026: Fix 1 (code review) - lam sach ten file client cung cap truoc khi dua vao object
// key MinIO/luu DB. Xem giai thich day du o sanitize-filename.util.ts.
import { MAX_FILE_NAME_LENGTH, sanitizeFileName } from './utils/sanitize-filename.util';
// 22/07/2026: Fix 4 (code review) - doi chieu magic-byte cua noi dung THAT SU voi mimetype
// client khai bao, boi vi mimeTypeFileFilter (tang multer) chi kiem tra duoc Content-Type do
// CLIENT tu khai bao. Xem giai thich day du o allowed-mime-types.ts.
// 25/07/2026: MAJOR fix (audit round) - them `hasReliableMagicByteCheck` de biet mimeType nao
// KHONG the doi chieu magic-byte (xem giai thich day du o allowed-mime-types.ts va o
// getDownloadUrl() ben duoi).
import { hasReliableMagicByteCheck, verifyFileContentMatchesMimeType } from './allowed-mime-types';
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

  async getDownloadUrl(
    organizationId: string,
    id: string,
    disposition: 'inline' | 'attachment' = 'attachment',
  ): Promise<{ downloadUrl: string }> {
    const fileMeta = await this.fileMetaRepo.findOne({ where: { id, organizationId } });
    if (!fileMeta) throw new NotFoundException('Khong tim thay file');

    // 25/07/2026: MAJOR fix (audit round) - stored content-sniffing XSS. `fileMeta.mimeType` la
    // Content-Type do CLIENT tu khai bao luc upload; voi 'text/plain'/'text/csv' khong ton tai
    // chu ky nhi phan dang tin cay de doi chieu (xem MAGIC_BYTE_CHECKS/hasReliableMagicByteCheck o
    // allowed-mime-types.ts) nen 1 file thuc chat la HTML/JS van co the "lot" qua voi mimeType gia
    // mao = 'text/plain'. Neu cho phep disposition=inline voi cac loai nay, MinIO presigned URL
    // (mien khac origin, KHONG dat duoc header X-Content-Type-Options: nosniff - presigned URL chi
    // override duoc response-content-type/response-content-disposition) se phuc vu lai dung
    // Content-Type gia mao do, va trinh duyet co the "sniff" noi dung roi RENDER/CHAY no nhu 1
    // trang HTML/script that ngay khi nguoi dung bam "Xem" (stored XSS qua file do nguoi dung khac
    // tai len). Vi vay: BAT BUOC ep disposition ve 'attachment' cho nhom mimeType khong the doi
    // chieu magic-byte, BAT KE FE yeu cau gi qua tham so `disposition` dau vao - file van tai
    // xuong (download) binh thuong, chi khong con duong "render truc tiep trong trinh duyet" nua.
    const effectiveDisposition = hasReliableMagicByteCheck(fileMeta.mimeType) ? disposition : 'attachment';
    const downloadUrl = await this.minioService.presignedGetObject(fileMeta.objectKey, 900, {
      'response-content-disposition': buildContentDisposition(effectiveDisposition, fileMeta.fileName),
    });
    return { downloadUrl };
  }

  async upload(
    organizationId: string,
    actorId: string,
    folderId: string | null,
    file: Express.Multer.File,
  ): Promise<FileMeta> {
    // 22/07/2026: Fix 1 (code review) - kiem tra do dai TEN FILE GOC va lam sach NGAY TU DAU
    // ham, TRUOC KHI dung no de tinh object key hay goi MinIO. Tu choi som (400) thay vi de loi
    // phat sinh sau khi da buffer/tai xong toan bo noi dung nhi phan len MinIO (lang phi bang
    // thong + I/O cho 1 request cuoi cung van bi tu choi).
    if (file.originalname.length > MAX_FILE_NAME_LENGTH) {
      throw new BadRequestException(`Ten file qua dai (toi da ${MAX_FILE_NAME_LENGTH} ky tu)`);
    }
    const sanitizedFileName = sanitizeFileName(file.originalname);

    // 22/07/2026: Fix 4 (code review) - xem giai thich day du o allowed-mime-types.ts. Phai chay
    // SAU KHI buffer san sang (file.buffer) va TRUOC khi goi MinioService.putObject ben duoi.
    verifyFileContentMatchesMimeType(file);

    if (folderId) {
      const folder = await this.folderRepo.findOne({ where: { id: folderId, organizationId } });
      if (!folder) throw new NotFoundException('Khong tim thay thu muc');
    }

    const fileId = uuidv4();
    const versionNumber = 1;
    // 22/07/2026: Fix 1 - dung TEN DA LAM SACH (khong phai file.originalname goc) de tinh object key.
    const objectKey = buildObjectKey(organizationId, fileId, versionNumber, sanitizedFileName);

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
          // 22/07/2026: Fix 1 - luu TEN DA LAM SACH: day la ten se duoc hien thi lai o FE va dua
          // vao Content-Disposition luc tai file ve sau nay (buildContentDisposition doc truc
          // tiep tu FileMeta.fileName, khong phai tu object key) - lam sach rieng cho object key
          // roi van luu ten goc vao DB se khong bao ve duoc duong Content-Disposition nay.
          fileName: sanitizedFileName,
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
    // 22/07/2026: Fix 1 (code review) - xem giai thich day du o upload() ben tren, ap dung dong
    // nhat cho duong tai phien ban moi.
    if (file.originalname.length > MAX_FILE_NAME_LENGTH) {
      throw new BadRequestException(`Ten file qua dai (toi da ${MAX_FILE_NAME_LENGTH} ky tu)`);
    }
    const sanitizedFileName = sanitizeFileName(file.originalname);

    // 22/07/2026: Fix 4 (code review) - ap dung dong nhat voi upload(): endpoint nay cung nhan 1
    // buffer file MOI va goi putObject nen mang chinh xac cung rui ro gia mao Content-Type (yeu
    // cau ban dau chi neu ro upload(), nhung bo qua o day se de lai 1 lo tuong tu chua duoc va).
    verifyFileContentMatchesMimeType(file);

    // 22/07/2026: Fix 2 (code review) - TOAN BO doc + tinh versionNumber + ghi FileVersion/cap
    // nhat FileMeta.currentVersion duoc dua vao 1 transaction DUY NHAT, khoa dong FileMeta bang
    // `lock: { mode: 'pessimistic_write' }` (cung pattern voi TasksService.updateStatus() cua
    // project-task-service). Truoc ban sua nay, `versionNumber` duoc doc tu 1 `findOne` KHONG
    // khoa - vi `buildObjectKey` la ham thuan/tat dinh tu (orgId, fileId, versionNumber, ten
    // file), 2 request tai phien ban moi CUNG LUC cho CUNG 1 file se doc duoc CUNG mot
    // currentVersion, tinh ra CUNG versionNumber va CUNG object key MinIO - request thu 2 goi
    // `putObject` se GHI DE THAM LANG len byte cua request thu nhat (khong loi, khong canh bao),
    // VA DB con co 2 dong FileVersion trung versionNumber (khong bi chan truoc ban sua nay). Khoa
    // pessimistic_write dam bao request thu 2 phai DOI request thu nhat commit xong (luc do
    // currentVersion da tang) roi moi doc duoc gia tri MOI NHAT - object key vi vay LUON duoc
    // tinh tu ban ghi VUA KHOA, khong bao gio tu 1 lan doc cu (stale) nhu truoc day.
    //
    // Danh doi co y thuc: `minioService.putObject` VAN nam TRONG pham vi giu khoa (khac de xuat
    // "co the de putObject ngoai khoa" trong yeu cau review) de giu nguyen bat bien da co san
    // trong file nay (xem comment o upload() o tren): "khong bao gio commit 1 dong FileMeta/
    // FileVersion tro toi object MinIO CHUA TON TAI". Neu tach putObject ra ngoai khoa (mo 1
    // transaction ngan hon chi de "dat cho" versionNumber roi nha khoa TRUOC khi goi MinIO), 1
    // loi MinIO tam thoi xay ra SAU khi da nha khoa se de lai FileMeta.currentVersion da tang
    // nhung khong co FileVersion/object noi dung tuong ung - te hon truong hop dang sua o day.
    // Thoi gian giu khoa bi chan tren boi MAX_UPLOAD_SIZE_BYTES (25MB - files.controller.ts) nen
    // chap nhan duoc voi quy mo SME cua he thong nay.
    const { updated, versionsToDelete } = await this.dataSource.transaction(async (manager) => {
      const fileMeta = await manager.findOne(FileMeta, {
        where: { id: fileId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!fileMeta) throw new NotFoundException('Khong tim thay file');

      const versionNumber = fileMeta.currentVersion + 1;
      // 22/07/2026: Fix 1 - dung TEN DA LAM SACH; Fix 2 - versionNumber tinh tu ban ghi VUA KHOA.
      const objectKey = buildObjectKey(organizationId, fileId, versionNumber, sanitizedFileName);

      await this.minioService.putObject(objectKey, file.buffer, file.size, file.mimetype);

      await manager.save(
        manager.create(FileVersion, {
          fileId,
          versionNumber,
          objectKey,
          sizeBytes: file.size,
          uploadedByUserId: actorId,
        }),
      );

      // 22/07/2026: Fix 1 - luu TEN DA LAM SACH, giong upload() o tren.
      fileMeta.fileName = sanitizedFileName;
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

  /**
   * 25/07/2026: MAJOR fix (audit round) - ghi chu chap nhan gioi han, KHONG sua trong ban nay:
   * `dto.sharedWithUserId` KHONG duoc doi chieu xem co thuc su thuoc CUNG to chuc voi
   * `organizationId` cua actor hay khong (khac voi moi duong DOC file khac trong service nay -
   * findOne/findAll/getDownloadUrl/remove... deu loc truc tiep tren `organizationId` cua
   * FileMeta). Hau qua: 1 user co the "share" 1 file cho 1 `sharedWithUserId` TUY Y (khong nhat
   * thiet thuoc cung to chuc), kich hoat event `document.shared` (Notification Service) nham vao userId
   * do - cho phep DO TIM (enumerate) xem 1 UUID co ton tai hop le trong he thong hay khong qua
   * viec quan sat co nhan duoc thong bao hay khong. KHONG cap them quyen truy cap DU LIEU trai
   * phep nao (moi duong doc file van tu doi chieu `organizationId` doc lap nhu tren) - day la 1
   * gioi han MUC DO THAP. Khong sua trong ban nay vi service nay KHONG co san co che goi HTTP sang
   * iam-service de tra cuu to chuc cua 1 userId (da xac nhan qua grep toan bo repo - chua ton tai
   * co che goi cheo service nao nhu vay o bat ky dau trong codebase nay) - xay dung co che do vuot
   * pham vi 1 ban sua loi cuc bo. Cung tinh than voi trade-off tuong tu duoc ghi nhan trong CUNG
   * dot audit nay o `TasksService.assign()` (apps/project-task-service/src/tasks/tasks.service.ts).
   */
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
