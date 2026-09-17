import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { FileMeta } from '../entities/file-meta.entity';
import { FileVersion } from '../entities/file-version.entity';
import { FileShare } from '../entities/file-share.entity';
import { Folder } from '../entities/folder.entity';
// 28/07/2026: dung chung logic canAccessFolder voi FoldersService - xem folder-access.service.ts.
import { AccessContext, FolderAccessService } from '../folders/folder-access.service';
import { OutboxService } from '../outbox/outbox.service';
import { MinioService } from '../minio/minio.service';
import { ShareFileDto } from './dto/share-file.dto';
import { buildObjectKey } from './utils/object-key.util';
import { buildContentDisposition } from './utils/content-disposition.util';
import { MAX_FILE_VERSIONS, pruneOldVersions } from './utils/version-retention.util';
// 22/07/2026: Fix 1 (code review) - lam sach ten file client cung cap truoc khi dua vao object
// key MinIO/luu DB. Xem giai thich day du o sanitize-filename.util.ts.
import { MAX_FILE_NAME_LENGTH, sanitizeFileName } from './utils/sanitize-filename.util';
// 16/09/2026: sua loi bao cao thuc te - ten file tieng Viet co dau bi mojibake (Busboy giai ma
// nham 'filename' cua multipart header la Latin-1). Phai chay TRUOC sanitizeFileName ben tren, o
// ca 2 diem nhan file.originalname ben duoi. Xem giai thich day du o decode-multer-filename.util.ts.
import { decodeMulterFilename } from './utils/decode-multer-filename.util';
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
  ERROR_CODES,
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
 *
 * 28/07/2026: cap nhat ghi chu tren - dieu do CHI CON dung cho file o cap ROOT (`folderId` null)
 * hoac nam trong 1 thu muc `visibility = ORGANIZATION` (mac dinh - opt-in). Voi file nam trong 1
 * thu muc `visibility = RESTRICTED`, `FileShare` (dung truc tiep tren file, khac voi
 * `FolderShare`) gio THUC SU dong vai tro chan truy cap - xem `canAccessFile()` ben duoi.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(FileMeta) private readonly fileMetaRepo: Repository<FileMeta>,
    @InjectRepository(FileVersion) private readonly fileVersionRepo: Repository<FileVersion>,
    // 28/07/2026: repo moi - can doc truc tiep de kiem tra "duong link rieng" trong canAccessFile()
    // (truoc day FileShare chi duoc dung qua `manager` ben trong transaction cua share()).
    @InjectRepository(FileShare) private readonly fileShareRepo: Repository<FileShare>,
    @InjectRepository(Folder) private readonly folderRepo: Repository<Folder>,
    private readonly outboxService: OutboxService,
    private readonly minioService: MinioService,
    // 28/07/2026: dung chung logic canAccessFolder voi FoldersService (xem folder-access.service.ts).
    private readonly folderAccessService: FolderAccessService,
  ) {}

  /**
   * 28/07/2026: kiem tra quyen truy cap 1 file don le (kiem soat truy cap tai lieu theo thu muc,
   * opt-in). File o cap ROOT (`folderId` null) LUON duoc phep - han che chi ap dung cho thu muc,
   * khong ap dung cho root (giu dung hanh vi org-wide cu). Voi file trong 1 thu muc: cho phep neu
   * canAccessFolder() cua thu muc cha tra ve true; NEU KHONG, van cho phep neu ton tai 1 dong
   * FileShare khop TRUC TIEP voi file nay (userId hoac departmentId cua nguoi goi) - day la
   * "duong link rieng toi 1 file don le" (vi du 1 Manager chia se rieng 1 hop dong cho 1 nhan vien
   * NGOAI pham vi duoc chia se cua ca thu muc chua no).
   */
  private async canAccessFile(organizationId: string, fileMeta: FileMeta, ctx: AccessContext): Promise<boolean> {
    if (!fileMeta.folderId) return true;

    const folder = await this.folderRepo.findOne({ where: { id: fileMeta.folderId, organizationId } });
    // Ve ly thuyet khong xay ra (FK folderId tro toi 1 Folder that su ton tai) - coi nhu khong bi
    // han che (fail-open cho truong hop du lieu khong nhat quan hon la chan nham nguoi dung hop le).
    if (!folder) return true;

    if (await this.folderAccessService.canAccessFolder(folder, ctx)) return true;

    const conditions: FindOptionsWhere<FileShare>[] = [{ fileId: fileMeta.id, sharedWithUserId: ctx.userId }];
    if (ctx.departmentId) {
      conditions.push({ fileId: fileMeta.id, sharedWithDepartmentId: ctx.departmentId });
    }
    const directShare = await this.fileShareRepo.findOne({ where: conditions });
    return !!directShare;
  }

  private async assertFileAccess(organizationId: string, fileMeta: FileMeta, ctx: AccessContext): Promise<void> {
    if (!(await this.canAccessFile(organizationId, fileMeta, ctx))) {
      throw new ForbiddenException({ message: 'Ban khong co quyen truy cap file nay', errorCode: ERROR_CODES.FORBIDDEN_FILE_ACCESS });
    }
  }

  // 28/07/2026: bo sung tham so `ctx` - neu `folderId` khac null VA nguoi goi khong xem duoc thu
  // muc do (canAccessFolder), TU CHOI TOAN BO viec liet ke (khong loc tung file rieng le - xem
  // giai thich trong yeu cau nhiem vu: 1 FileShare TRUC TIEP tren tung file la "duong link rieng"
  // cho truy cap 1 file DON LE, KHONG lam file do "xuat hien" trong 1 danh sach duyet thu muc ma
  // nguoi dung khong duoc xem). Neu thu muc khong ton tai (VD sai to chuc), giu nguyen hanh vi cu
  // - khong nem loi moi, chi de query ben duoi tra danh sach rong nhu truoc day.
  async findAll(
    organizationId: string,
    folderId: string | undefined,
    query: PaginationQueryDto,
    ctx: AccessContext,
  ): Promise<PaginatedResponse<FileMeta>> {
    if (folderId) {
      const folder = await this.folderRepo.findOne({ where: { id: folderId, organizationId } });
      if (folder && !(await this.folderAccessService.canAccessFolder(folder, ctx))) {
        throw new ForbiddenException({
          message: 'Ban khong co quyen xem danh sach file trong thu muc nay',
          errorCode: ERROR_CODES.FORBIDDEN_FILE_LIST_ACCESS,
        });
      }
    }
    const [data, total] = await this.fileMetaRepo.findAndCount({
      where: { organizationId, folderId: folderId ? folderId : IsNull() },
      order: { updatedAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  // 28/07/2026: bo sung tham so `ctx` + assertFileAccess() - xem canAccessFile() o tren.
  async findOne(organizationId: string, id: string, ctx: AccessContext): Promise<FileMeta & { versions: FileVersion[] }> {
    const fileMeta = await this.fileMetaRepo.findOne({ where: { id, organizationId } });
    if (!fileMeta) throw new NotFoundException({ message: 'Khong tim thay file', errorCode: ERROR_CODES.FILE_NOT_FOUND });
    await this.assertFileAccess(organizationId, fileMeta, ctx);
    const versions = await this.fileVersionRepo.find({
      where: { fileId: id },
      order: { versionNumber: 'DESC' },
    });
    return { ...fileMeta, versions };
  }

  // 28/07/2026: bo sung tham so `ctx` + assertFileAccess() - khong the tao URL tai file cho nguoi
  // khong co quyen truy cap file do.
  async getDownloadUrl(
    organizationId: string,
    id: string,
    disposition: 'inline' | 'attachment' = 'attachment',
    ctx: AccessContext,
  ): Promise<{ downloadUrl: string }> {
    const fileMeta = await this.fileMetaRepo.findOne({ where: { id, organizationId } });
    if (!fileMeta) throw new NotFoundException({ message: 'Khong tim thay file', errorCode: ERROR_CODES.FILE_NOT_FOUND });
    await this.assertFileAccess(organizationId, fileMeta, ctx);

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

  // 28/07/2026: CO CHU DICH KHONG kiem tra canAccessFolder o day (kiem soat truy cap thu muc,
  // opt-in - yeu cau nhiem vu chi liet ke GET /files/:id, download URL, share(), remove(),
  // uploadNewVersion() la cac "single-file operations" can gac, KHONG bao gom upload() tao file
  // MOI). Tao 1 file MOI vao 1 thu muc RESTRICTED ma nguoi goi khong xem duoc van la 1 khe ho ly
  // thuyet (can biet truoc UUID cua thu muc), nhung nam ngoai pham vi liet ke cua nhiem vu nay -
  // ghi nhan la gioi han da biet, giong tinh than cac comment gioi han khac trong file nay.
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
    // 16/09/2026: sua ten file bi mojibake TRUOC KHI kiem tra do dai/lam sach - xem
    // decode-multer-filename.util.ts.
    const decodedOriginalName = decodeMulterFilename(file.originalname);
    if (decodedOriginalName.length > MAX_FILE_NAME_LENGTH) {
      throw new BadRequestException({
        message: `Ten file qua dai (toi da ${MAX_FILE_NAME_LENGTH} ky tu)`,
        errorCode: ERROR_CODES.FILE_NAME_TOO_LONG,
        errorParams: { max: MAX_FILE_NAME_LENGTH },
      });
    }
    const sanitizedFileName = sanitizeFileName(decodedOriginalName);

    // 22/07/2026: Fix 4 (code review) - xem giai thich day du o allowed-mime-types.ts. Phai chay
    // SAU KHI buffer san sang (file.buffer) va TRUOC khi goi MinioService.putObject ben duoi.
    verifyFileContentMatchesMimeType(file);

    if (folderId) {
      const folder = await this.folderRepo.findOne({ where: { id: folderId, organizationId } });
      if (!folder) throw new NotFoundException({ message: 'Khong tim thay thu muc', errorCode: ERROR_CODES.FOLDER_NOT_FOUND });
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
    ctx: AccessContext,
  ): Promise<FileMeta> {
    // 22/07/2026: Fix 1 (code review) - xem giai thich day du o upload() ben tren, ap dung dong
    // nhat cho duong tai phien ban moi.
    // 16/09/2026: sua ten file bi mojibake TRUOC KHI kiem tra do dai/lam sach - xem
    // decode-multer-filename.util.ts.
    const decodedOriginalName = decodeMulterFilename(file.originalname);
    if (decodedOriginalName.length > MAX_FILE_NAME_LENGTH) {
      throw new BadRequestException({
        message: `Ten file qua dai (toi da ${MAX_FILE_NAME_LENGTH} ky tu)`,
        errorCode: ERROR_CODES.FILE_NAME_TOO_LONG,
        errorParams: { max: MAX_FILE_NAME_LENGTH },
      });
    }
    const sanitizedFileName = sanitizeFileName(decodedOriginalName);

    // 22/07/2026: Fix 4 (code review) - ap dung dong nhat voi upload(): endpoint nay cung nhan 1
    // buffer file MOI va goi putObject nen mang chinh xac cung rui ro gia mao Content-Type (yeu
    // cau ban dau chi neu ro upload(), nhung bo qua o day se de lai 1 lo tuong tu chua duoc va).
    verifyFileContentMatchesMimeType(file);

    // 28/07/2026: kiem tra quyen truy cap (kiem soat truy cap thu muc, opt-in) TRUOC khi mo
    // transaction khoa row ben duoi. Doc `fileMeta` o day KHONG khoa - chi dung de xac thuc quyen,
    // hoan toan tach biet voi bat bien "khoa pessimistic_write truoc khi tinh versionNumber" da
    // giai thich chi tiet o comment Fix 2 ben duoi (transaction se tu doc lai 1 lan nua, CO khoa,
    // ngay sau day - khong dua thang `fileMeta` doc o day vao logic tinh versionNumber).
    const fileMetaForAccessCheck = await this.fileMetaRepo.findOne({ where: { id: fileId, organizationId } });
    if (!fileMetaForAccessCheck) throw new NotFoundException({ message: 'Khong tim thay file', errorCode: ERROR_CODES.FILE_NOT_FOUND });
    await this.assertFileAccess(organizationId, fileMetaForAccessCheck, ctx);

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
      if (!fileMeta) throw new NotFoundException({ message: 'Khong tim thay file', errorCode: ERROR_CODES.FILE_NOT_FOUND });

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
  // 28/07/2026: bo sung tham so `ctx` + assertFileAccess() - nguoi CHIA SE 1 file cung phai tu
  // minh xem duoc file do (khong the "chia se tiep" 1 file ma chinh minh khong co quyen truy cap).
  // Bo sung validate "CHINH XAC 1 trong 2" (sharedWithUserId/sharedWithDepartmentId, cung quy uoc
  // voi FolderShare) VA ho tro chia se theo PHONG BAN (`sharedWithDepartmentId`) - xem giai thich
  // day du o docblock FileShare entity va ShareFileDto.
  async share(
    organizationId: string,
    actorId: string,
    fileId: string,
    dto: ShareFileDto,
    ctx: AccessContext,
  ): Promise<FileShare> {
    const fileMeta = await this.fileMetaRepo.findOne({ where: { id: fileId, organizationId } });
    if (!fileMeta) throw new NotFoundException({ message: 'Khong tim thay file', errorCode: ERROR_CODES.FILE_NOT_FOUND });
    await this.assertFileAccess(organizationId, fileMeta, ctx);

    const hasUser = !!dto.sharedWithUserId;
    const hasDepartment = !!dto.sharedWithDepartmentId;
    if (hasUser === hasDepartment) {
      throw new BadRequestException({
        message: 'Phai cung cap chinh xac mot trong hai: sharedWithUserId hoac sharedWithDepartmentId',
        errorCode: ERROR_CODES.SHARE_TARGET_REQUIRED,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      let share = await manager.findOne(FileShare, {
        where: hasUser
          ? { fileId, sharedWithUserId: dto.sharedWithUserId }
          : { fileId, sharedWithDepartmentId: dto.sharedWithDepartmentId },
      });
      if (share) {
        share.permission = dto.permission;
        share.sharedByUserId = actorId;
      } else {
        share = manager.create(FileShare, {
          fileId,
          sharedWithUserId: dto.sharedWithUserId ?? null,
          sharedWithDepartmentId: dto.sharedWithDepartmentId ?? null,
          permission: dto.permission,
          sharedByUserId: actorId,
        });
      }
      const saved = await manager.save(share);

      // 28/07/2026: outbox event `document.shared` CHI phat khi chia se cho 1 USER cu the (giu
      // nguyen hanh vi cu) - `DocumentSharedPayload` (packages/common-dto, ngoai pham vi sua doi
      // cua nhiem vu nay) chi mang duoc 1 `sharedWithUserId` dang string BAT BUOC, chua co hinh
      // dang tuong duong cho truong hop chia se theo PHONG BAN (can bao TOAN BO thanh vien phong
      // ban, khong phai 1 userId don). Nang cap common-dto + Notification Service de ho tro thong
      // bao theo phong ban vuot pham vi apps/document-service/src/** cua nhiem vu nay - chap nhan
      // gioi han: chia se theo phong ban van duoc luu DUNG vao FileShare (kiem soat truy cap thuc
      // su van hoat dong day du qua canAccessFile()), chi khong kich hoat thong bao rieng cho tung
      // thanh vien phong ban o buoc nay.
      if (hasUser) {
        const payload: DocumentSharedPayload = {
          fileId,
          sharedWithUserId: dto.sharedWithUserId as string,
          actorId,
        };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.DOCUMENT_SHARED,
          organizationId,
          producer: PRODUCER,
          payload: payload as unknown as Record<string, unknown>,
        });
      }

      return saved;
    });
  }

  // 28/07/2026: bo sung tham so `ctx` + assertFileAccess() - khong the xoa 1 file ma nguoi goi
  // khong co quyen truy cap.
  async remove(organizationId: string, actorId: string, id: string, ctx: AccessContext): Promise<void> {
    const fileMetaForAccessCheck = await this.fileMetaRepo.findOne({ where: { id, organizationId } });
    if (!fileMetaForAccessCheck) throw new NotFoundException({ message: 'Khong tim thay file', errorCode: ERROR_CODES.FILE_NOT_FOUND });
    await this.assertFileAccess(organizationId, fileMetaForAccessCheck, ctx);

    // 25/08/2026: fix code review Major (phat hien qua dot ra soat toan du an lan 3) - ban sua
    // 22/08/2026 (doc FileVersion bang `manager` TRONG transaction) van con 1 khe ho: doc do KHONG
    // khoa FileMeta, nen van dua vao THOI DIEM doc, khong dong bo voi uploadNewVersion() (ham do DA
    // khoa pessimistic_write tren cung row - xem giai thich Fix 2, 22/07/2026, ngay phia tren ham
    // nay). Kich ban: uploadNewVersion() dang chay song song chen xong 1 FileVersion moi (vd v4) va
    // COMMIT ngay SAU khi remove() da doc xong danh sach cu (v1..v3) nhung TRUOC khi remove() xoa
    // FileMeta - row FileVersion cua v4 van bi FK CASCADE xoa theo FileMeta nhung object MinIO cua
    // no KHONG nam trong danh sach da doc nen KHONG BAO GIO duoc goi removeObject() - mo coi VINH
    // VIEN va HOAN TOAN KHONG CON DAU VET DB de doi chieu lai (nang hon ca truong hop xoa MinIO that
    // bai da biet o Technical_Spec.md muc 14, von it nhat con duoc log lai). Khoa dong bo hoa: doc
    // lai FileMeta VOI `lock: { mode: 'pessimistic_write' }` TRUOC khi doc FileVersion, dam bao 2
    // ham nay khong con chay xen ke tren cung 1 file.
    const versions = await this.dataSource.transaction(async (manager) => {
      const fileMeta = await manager.findOne(FileMeta, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!fileMeta) throw new NotFoundException({ message: 'Khong tim thay file', errorCode: ERROR_CODES.FILE_NOT_FOUND });

      const versionsInTx = await manager.find(FileVersion, { where: { fileId: id } });

      // Cascade xoa FileVersion + FileShare o tang DB (onDelete: CASCADE tren ca 2 entity).
      await manager.remove(fileMeta);

      const payload: DocumentDeletedPayload = { fileId: id, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.DOCUMENT_DELETED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return versionsInTx;
    });

    for (const version of versions) {
      await this.minioService
        .removeObject(version.objectKey)
        .catch((err) => this.logger.warn(`Khong the xoa object MinIO ${version.objectKey}: ${err}`));
    }
  }
}
