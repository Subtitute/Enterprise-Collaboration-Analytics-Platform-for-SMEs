import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Folder } from '../entities/folder.entity';
import { FileMeta } from '../entities/file-meta.entity';
import { FileVersion } from '../entities/file-version.entity';
// 28/07/2026: entity + service moi - kiem soat truy cap thu muc (opt-in). Xem chu thich chi tiet
// tai folder-access.service.ts.
import { FolderShare } from '../entities/folder-share.entity';
import { AccessContext, FolderAccessService } from './folder-access.service';
import { MinioService } from '../minio/minio.service';
import { OutboxService } from '../outbox/outbox.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { CreateFolderShareDto } from './dto/create-folder-share.dto';
import { DocumentDeletedPayload, ERROR_CODES, EVENT_TYPES } from '@app/common-dto';

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
    // 28/07/2026: repo moi - CRUD cho endpoint /folders/:id/shares ben duoi.
    @InjectRepository(FolderShare) private readonly folderShareRepo: Repository<FolderShare>,
    private readonly minioService: MinioService,
    private readonly outboxService: OutboxService,
    // 28/07/2026: dung chung logic canAccessFolder voi FilesService - xem folder-access.service.ts.
    private readonly folderAccessService: FolderAccessService,
  ) {}

  // 28/07/2026: bo sung tham so `ctx` (kiem soat truy cap thu muc, opt-in) - loc BO LANG (khong
  // nem loi) cac thu muc `ctx` khong xem duoc ra khoi danh sach tra ve, dung voi yeu cau nhiem vu
  // "day la 1 danh sach, khong phai truong hop loi - im lang bo qua nhung gi khong xem duoc".
  async findAll(organizationId: string, parentFolderId: string | undefined, ctx: AccessContext): Promise<Folder[]> {
    const folders = await this.folderRepo.find({
      where: { organizationId, parentFolderId: parentFolderId ? parentFolderId : IsNull() },
      order: { name: 'ASC' },
    });
    const accessFlags = await Promise.all(folders.map((folder) => this.folderAccessService.canAccessFolder(folder, ctx)));
    return folders.filter((_folder, index) => accessFlags[index]);
  }

  async create(organizationId: string, actorId: string, dto: CreateFolderDto): Promise<Folder> {
    if (dto.parentFolderId) {
      const parent = await this.folderRepo.findOne({
        where: { id: dto.parentFolderId, organizationId },
      });
      if (!parent) throw new NotFoundException({ message: 'Khong tim thay thu muc cha', errorCode: ERROR_CODES.PARENT_FOLDER_NOT_FOUND });
    }
    const folder = this.folderRepo.create({
      organizationId,
      parentFolderId: dto.parentFolderId ?? null,
      name: dto.name,
      createdByUserId: actorId,
    });
    return this.folderRepo.save(folder);
  }

  // 28/07/2026: bo sung tham so `ctx` va 2 lop kiem tra quyen MOI (kiem soat truy cap thu muc,
  // opt-in): (1) nguoi goi PHAI xem duoc thu muc (canAccessFolder) - khac voi findAll() (loc bo
  // lang), o day la thao tac SUA TRUC TIEP 1 thu muc CU THE nen 403 ro rang la phan hoi dung/huu
  // ich hon (thu muc THUC SU ton tai trong to chuc ho, chi la ho khong duoc phep dong vao, khac
  // voi NotFoundException dung cho truong hop khac to chuc/khong ton tai); (2) rieng viec DOI
  // `visibility` con bi han che chat hon nua - CHI nguoi tao thu muc hoac Org Admin, tranh 1 thanh
  // vien BAT KY co quyen xem thu muc (vi du qua 1 FolderShare) tu y bat/tat che do han che cua thu
  // muc nguoi khac tao.
  async update(organizationId: string, id: string, dto: UpdateFolderDto, ctx: AccessContext): Promise<Folder> {
    const folder = await this.folderRepo.findOne({ where: { id, organizationId } });
    if (!folder) throw new NotFoundException({ message: 'Khong tim thay thu muc', errorCode: ERROR_CODES.FOLDER_NOT_FOUND });

    if (!(await this.folderAccessService.canAccessFolder(folder, ctx))) {
      throw new ForbiddenException({ message: 'Ban khong co quyen truy cap thu muc nay', errorCode: ERROR_CODES.FORBIDDEN_FOLDER_ACCESS });
    }

    // 28/07/2026: chi gan lai `name` khi THUC SU duoc truyen - xem ghi chu tai UpdateFolderDto.name
    // (truoc day gan vo dieu kien `folder.name = dto.name`, luc `name` con la truong bat buoc duy
    // nhat cua DTO nay; nay `name` la optional nen gan vo dieu kien se ghi `undefined` len ten thu
    // muc neu client chi gui `{ visibility }`).
    if (dto.name !== undefined) {
      folder.name = dto.name;
    }

    if (dto.visibility !== undefined) {
      this.assertFolderOwnerOrOrgAdmin(folder, ctx);
      folder.visibility = dto.visibility;
    }

    return this.folderRepo.save(folder);
  }

  // 28/07/2026: ham dung chung - chi nguoi TAO thu muc hoac Org Admin duoc doi visibility/quan ly
  // danh sach chia se (createShare/listShares/removeShare ben duoi) cua 1 thu muc.
  private assertFolderOwnerOrOrgAdmin(folder: Folder, ctx: AccessContext): void {
    if (folder.createdByUserId !== ctx.userId && !ctx.isOrgAdmin) {
      throw new ForbiddenException({
        message: 'Chi nguoi tao thu muc hoac Quan tri vien to chuc moi duoc thuc hien thao tac nay',
        errorCode: ERROR_CODES.FORBIDDEN_FOLDER_MODIFY,
      });
    }
  }

  /**
   * 28/07/2026: endpoint moi `POST /folders/:id/shares` - chia se 1 thu muc RESTRICTED cho 1
   * nguoi dung hoac 1 phong ban CU THE. Chi nguoi tao thu muc/Org Admin duoc tao chia se (giong
   * han che ap dung cho doi visibility o update() tren). Tu choi neu thu muc DA duoc chia se voi
   * dung nguoi dung/phong ban do (tranh cac dong FolderShare trung lap vo nghia).
   */
  async createShare(organizationId: string, folderId: string, ctx: AccessContext, dto: CreateFolderShareDto): Promise<FolderShare> {
    const folder = await this.folderRepo.findOne({ where: { id: folderId, organizationId } });
    if (!folder) throw new NotFoundException({ message: 'Khong tim thay thu muc', errorCode: ERROR_CODES.FOLDER_NOT_FOUND });
    this.assertFolderOwnerOrOrgAdmin(folder, ctx);

    const hasUser = !!dto.sharedWithUserId;
    const hasDepartment = !!dto.sharedWithDepartmentId;
    if (hasUser === hasDepartment) {
      throw new BadRequestException({
        message: 'Phai cung cap chinh xac mot trong hai: sharedWithUserId hoac sharedWithDepartmentId',
        errorCode: ERROR_CODES.SHARE_TARGET_REQUIRED,
      });
    }

    const existing = await this.folderShareRepo.findOne({
      where: hasUser
        ? { folderId, sharedWithUserId: dto.sharedWithUserId }
        : { folderId, sharedWithDepartmentId: dto.sharedWithDepartmentId },
    });
    if (existing) {
      throw new BadRequestException({
        message: 'Thu muc nay da duoc chia se voi nguoi dung/phong ban nay',
        errorCode: ERROR_CODES.FOLDER_ALREADY_SHARED,
      });
    }

    const share = this.folderShareRepo.create({
      folderId,
      sharedWithUserId: dto.sharedWithUserId ?? null,
      sharedWithDepartmentId: dto.sharedWithDepartmentId ?? null,
      sharedByUserId: ctx.userId,
    });
    return this.folderShareRepo.save(share);
  }

  /**
   * 28/07/2026: endpoint moi `GET /folders/:id/shares` - liet ke chia se hien tai cua 1 thu muc
   * (de FE hien thi "da chia se voi X, Y"). Cung han che voi createShare() - CHI nguoi tao thu
   * muc/Org Admin duoc xem danh sach nay (khong lo danh sach chia se cho 1 nguoi chi DUOC chia se
   * quyen xem thu muc qua 1 FolderShare khac).
   */
  async listShares(organizationId: string, folderId: string, ctx: AccessContext): Promise<FolderShare[]> {
    const folder = await this.folderRepo.findOne({ where: { id: folderId, organizationId } });
    if (!folder) throw new NotFoundException({ message: 'Khong tim thay thu muc', errorCode: ERROR_CODES.FOLDER_NOT_FOUND });
    this.assertFolderOwnerOrOrgAdmin(folder, ctx);
    return this.folderShareRepo.find({ where: { folderId }, order: { createdAt: 'DESC' } });
  }

  /** 28/07/2026: endpoint moi `DELETE /folders/:id/shares/:shareId` - go 1 chia se. Cung han che voi createShare()/listShares(). */
  async removeShare(organizationId: string, folderId: string, shareId: string, ctx: AccessContext): Promise<void> {
    const folder = await this.folderRepo.findOne({ where: { id: folderId, organizationId } });
    if (!folder) throw new NotFoundException({ message: 'Khong tim thay thu muc', errorCode: ERROR_CODES.FOLDER_NOT_FOUND });
    this.assertFolderOwnerOrOrgAdmin(folder, ctx);

    const share = await this.folderShareRepo.findOne({ where: { id: shareId, folderId } });
    if (!share) throw new NotFoundException({ message: 'Khong tim thay chia se', errorCode: ERROR_CODES.SHARE_NOT_FOUND });
    await this.folderShareRepo.remove(share);
  }

  /**
   * Xoa 1 thu muc va toan bo cay con.
   *
   * Luu y quan trong: `FileMeta.folderId` dung `onDelete: SET NULL` (khong phai CASCADE -
   * xem file-meta.entity.ts, dung cho truong hop 1 file duoc "day len root" khi thu muc
   * chua no bi xoa don le). Vi vay DB se KHONG tu xoa file khi ta xoa thu muc - o day PHAI
   * tu xu ly tuong minh truoc khi xoa thu muc:
   *   1. Tim toan bo Folder id thuoc cay con (BFS qua parentFolderId).
   *   2. Trong 1 transaction DUY NHAT (giong pattern cua FilesService.remove()): tim toan bo
   *      FileMeta (+ FileVersion cua chung) thuoc cac thu muc do, xoa tuong minh cac dong
   *      FileMeta (DB cascade tiep FileVersion/FileShare qua onDelete: CASCADE cua rieng
   *      chung), xoa thu muc goc (DB tu cascade xoa toan bo thu muc con qua Folder tu tham
   *      chieu onDelete: CASCADE), VA ghi 1 outbox event `document.deleted` cho MOI file bi
   *      xoa - truoc ban sua loi nay, xoa ca thu muc chua file la thao tac "vo hinh" voi
   *      Analytics/consumer khac vi khong outbox event nao duoc phat.
   *   3. Sau khi transaction commit thanh cong: xoa object MinIO cua TAT CA phien ban cua
   *      cac file do - best-effort, khong the lam transactional xuyen he thong (MinIO nam
   *      ngoai DB transaction) - giong dung tradeoff da chap nhan o FilesService.remove()
   *      va Technical_Spec.md muc 14 (don dep object mo coi la gioi han da biet).
   *
   * 25/07/2026: MINOR fix (audit round, race condition) - buoc 2 (tim FileMeta/FileVersion) truoc
   * day chay TRUOC khi mo transaction (dung `fileMetaRepo`/`fileVersionRepo` thuong, khong phai
   * `manager`). Dieu do de lai 1 khoang ho KHONG co bat ky rang buoc thu tu nao voi thao tac xoa
   * ben duoi: 1 file MOI co the duoc upload vao thu muc sap bi xoa TRONG khoang ho do (thoat khoi
   * danh sach `files` da chup snapshot, song sot qua `onDelete: SET NULL`, tro thanh "mo coi" o
   * root) hoac 1 version MOI duoc them vao 1 file DA chup snapshot (object MinIO cua version do
   * khong nam trong `versions` da chup, tro thanh object "mo coi" tren MinIO sau khi FileMeta cha
   * bi xoa). Fix: chuyen han buoc tim FileMeta/FileVersion VAO TRONG transaction, doc bang chinh
   * `manager` NGAY TRUOC khi xoa - Postgres mac dinh isolation READ COMMITTED nen moi cau lenh
   * trong 1 transaction doc du lieu MOI NHAT da commit tai THOI DIEM no chay (khong phai 1 snapshot
   * co dinh tu luc BAT DAU transaction), nen doc lai o day thu hep toi da khoang ho con lai (chi
   * con vai buoc await TUAN TU trong CUNG 1 transaction, thay vi 1 khoang thoi gian tach roi truoc
   * do). Day KHONG phai fix TUYET DOI (van chua khoa tuong minh (`pessimistic_write`) tren cay thu
   * muc/FileMeta lien quan xuyen suot transaction) - lam vay doi hoi khoa ca cay thu muc, vuot qua
   * muc "cheap fix" hop ly cho pham vi ban sua nay - nhung da loai bo hoan toan khoang ho "rong"
   * truoc-transaction la phan lon rui ro thuc te.
   */
  // 28/07/2026: bo sung tham so `ctx` - nguoi goi phai xem duoc thu muc (canAccessFolder) moi
  // duoc xoa no, cung logic/thong diep loi voi update() o tren (403, khong phai 404 - thu muc
  // THUC SU ton tai trong to chuc ho).
  async remove(organizationId: string, actorId: string, id: string, ctx: AccessContext): Promise<void> {
    const folder = await this.folderRepo.findOne({ where: { id, organizationId } });
    if (!folder) throw new NotFoundException({ message: 'Khong tim thay thu muc', errorCode: ERROR_CODES.FOLDER_NOT_FOUND });
    if (!(await this.folderAccessService.canAccessFolder(folder, ctx))) {
      throw new ForbiddenException({ message: 'Ban khong co quyen truy cap thu muc nay', errorCode: ERROR_CODES.FORBIDDEN_FOLDER_ACCESS });
    }

    const folderIds = await this.collectFolderTreeIds(organizationId, id);

    // 25/07/2026: doc FileMeta/FileVersion bang `manager` (trong transaction), khong phai bang
    // `fileMetaRepo`/`fileVersionRepo` (ngoai transaction) nhu ban cu - xem giai thich day du o
    // docblock cua ham ngay tren.
    //
    // 26/08/2026 (fix code review, loi CRITICAL - cung nhom loi da sua 25/08/2026 o
    // FilesService.remove()): doc FileMeta o day truoc do van con THIEU khoa pessimistic_write
    // truoc khi doc FileVersion cua chung, dua vao THOI DIEM doc (READ COMMITTED), khong dong bo
    // voi FilesService.uploadNewVersion() (ham do DA khoa pessimistic_write tren tung dong FileMeta
    // truoc khi them FileVersion). Kich ban: uploadNewVersion() dang chay song song chen xong 1
    // FileVersion moi (vd v4) cho 1 file thuoc thu muc nay va COMMIT ngay SAU khi remove() da doc
    // xong danh sach FileVersion cu (v1..v3) nhung TRUOC khi remove() xoa FileMeta - row FileVersion
    // v4 van bi FK CASCADE xoa theo FileMeta nhung object MinIO cua no KHONG nam trong `versions`
    // da doc nen KHONG BAO GIO duoc goi removeObject() - mo coi VINH VIEN, hoan toan khong con dau
    // vet DB de doi chieu lai. Sua bang CHINH XAC pattern cua FilesService.remove(): khoa
    // pessimistic_write tren TOAN BO dong FileMeta thuoc cac thu muc nay TRUOC khi doc FileVersion -
    // moi uploadNewVersion() dong thoi tren BAT KY file nao trong so nay se phai doi transaction nay
    // commit/rollback xong (roi that bai voi 404 vi FileMeta da bi xoa) thay vi chen duoc 1
    // FileVersion "mo coi" giua chung.
    const versions = await this.dataSource.transaction(async (manager) => {
      const files = await manager.find(FileMeta, {
        where: { folderId: In(folderIds) },
        lock: { mode: 'pessimistic_write' },
      });
      const fileIds = files.map((f) => f.id);
      const versionsInTx =
        fileIds.length > 0 ? await manager.find(FileVersion, { where: { fileId: In(fileIds) } }) : [];

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
      return versionsInTx;
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
