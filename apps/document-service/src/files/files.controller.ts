import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
// 25/07/2026: MAJOR fix (audit round) - dung ham thuan `isUUID` (khong phai decorator) de tu
// validate `folderId` doc tho tu multipart form-data (xem giai thich day du tai noi dung dung ham
// nay trong upload() ben duoi).
import { isUUID } from 'class-validator';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { FilesService } from './files.service';
import { ShareFileDto } from './dto/share-file.dto';
import { mimeTypeFileFilter } from './allowed-mime-types';
// 22/07/2026: Fix 5 (code review) - DTO validate UUID cho query `folderId`.
import { FindFilesQueryDto } from './dto/find-files-query.dto';
// 28/07/2026: kieu ngu canh dung chung (kiem soat truy cap thu muc, opt-in) - xem folder-access.service.ts.
import { AccessContext } from '../folders/folder-access.service';

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

/** Module Tai lieu - Wireframe.md muc 5. */
@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // 28/07/2026: dung chung, mirror pattern `canManageUsers` cua UsersController (iam-service) -
  // xem chu thich tuong tu o folders.controller.ts.
  private buildAccessContext(userId: string, departmentId: string | null, permissions: string[]): AccessContext {
    return { userId, departmentId, isOrgAdmin: (permissions ?? []).includes(PERMISSIONS.ORG_MANAGE) };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    // 28/07/2026: bo sung userId/departmentId/permissions - can de tu choi liet ke neu `folderId`
    // tro toi 1 thu muc RESTRICTED nguoi goi khong xem duoc (kiem soat truy cap thu muc, opt-in).
    @CurrentUser('userId') userId: string,
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    // 22/07/2026: Fix 5 (code review) - gop `folderId` + phan trang vao 1 DTO co validate UUID
    // (xem giai thich day du o dto/find-files-query.dto.ts), thay vi doc tho
    // `@Query('folderId') folderId: string | undefined`.
    @Query() query: FindFilesQueryDto,
  ) {
    return this.filesService.findAll(
      organizationId,
      query.folderId,
      query,
      this.buildAccessContext(userId, departmentId, permissions),
    );
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    // 28/07/2026: bo sung userId/departmentId/permissions - kiem tra quyen truy cap file (kiem
    // soat truy cap thu muc, opt-in).
    @CurrentUser('userId') userId: string,
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    @Param('id') id: string,
  ) {
    return this.filesService.findOne(organizationId, id, this.buildAccessContext(userId, departmentId, permissions));
  }

  // 22/07/2026: bo sung query `disposition` de FE phan biet "Xem" (inline - trinh duyet tu
  // render truc tiep neu ho tro, vd PDF/anh/text) va "Tai xuong" (attachment - luon mo hop
  // thoai Luu tap tin) - truoc do URL luon khong dat Content-Disposition nen hanh vi mo/tai
  // phu thuoc "tinh co" vao Content-Type, khong the chu dong tach 2 hanh dong ro rang o FE.
  @Get(':id/download')
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  getDownloadUrl(
    @CurrentUser('organizationId') organizationId: string,
    // 28/07/2026: bo sung userId/departmentId/permissions - kiem tra quyen truy cap file (kiem
    // soat truy cap thu muc, opt-in).
    @CurrentUser('userId') userId: string,
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    @Param('id') id: string,
    @Query('disposition') disposition?: string,
  ) {
    return this.filesService.getDownloadUrl(
      organizationId,
      id,
      disposition === 'inline' ? 'inline' : 'attachment',
      this.buildAccessContext(userId, departmentId, permissions),
    );
  }

  @Post('upload')
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
      fileFilter: mimeTypeFileFilter,
    }),
  )
  upload(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('folderId') folderId?: string,
  ) {
    if (!file) throw new BadRequestException('Thieu file can tai len');
    // 25/07/2026: MAJOR fix (audit round) - `folderId` o day duoc doc THO qua `@Body('folderId')`
    // (mot truong ke ben file nhi phan trong multipart/form-data), KHONG phai 1 DTO co kieu class
    // - ValidationPipe toan cuc CHI validate `@Body()` khi tham so nhan 1 DTO dang class (xem
    // giai thich tuong tu o dto/find-files-query.dto.ts cho query param `folderId` cua GET
    // /files), nen gia tri kieu nay hoan toan KHONG di qua buoc validate nao. Truoc ban sua nay,
    // 1 gia tri rac (vd "abc") di thang xuong FilesService.upload() -> truy van Postgres tren cot
    // uuid `Folder.id` -> nem QueryFailedError THO, bi AllExceptionsFilter bien thanh 1 loi 500
    // chung chung thay vi 1 loi 400 sach. Validate tuong minh o day: bo qua khi khong co gia tri
    // (`folderId` rong/undefined = tai len thu muc goc, quy uoc hop le - xem
    // `folderId || null` ben duoi), chi kiem tra hinh dang UUID khi CO gia tri.
    if (folderId && !isUUID(folderId, '4')) {
      throw new BadRequestException('folderId phai la UUID hop le');
    }
    return this.filesService.upload(organizationId, actorId, folderId || null, file);
  }

  @Post(':id/upload')
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
      fileFilter: mimeTypeFileFilter,
    }),
  )
  uploadNewVersion(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    // 28/07/2026: bo sung departmentId/permissions - kiem tra quyen truy cap file (kiem soat truy
    // cap thu muc, opt-in).
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Thieu file can tai len');
    return this.filesService.uploadNewVersion(
      organizationId,
      actorId,
      id,
      file,
      this.buildAccessContext(actorId, departmentId, permissions),
    );
  }

  @Post(':id/share')
  @RequirePermissions(PERMISSIONS.DOCUMENT_SHARE)
  share(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    // 28/07/2026: bo sung departmentId/permissions - nguoi chia se cung phai tu minh xem duoc
    // file do (kiem soat truy cap thu muc, opt-in).
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    @Param('id') id: string,
    @Body() dto: ShareFileDto,
  ) {
    return this.filesService.share(
      organizationId,
      actorId,
      id,
      dto,
      this.buildAccessContext(actorId, departmentId, permissions),
    );
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_DELETE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    // 28/07/2026: bo sung departmentId/permissions - kiem tra quyen truy cap file truoc khi cho
    // xoa (kiem soat truy cap thu muc, opt-in).
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    @Param('id') id: string,
  ) {
    return this.filesService.remove(
      organizationId,
      actorId,
      id,
      this.buildAccessContext(actorId, departmentId, permissions),
    );
  }
}
