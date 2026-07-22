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
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { FilesService } from './files.service';
import { ShareFileDto } from './dto/share-file.dto';
import { mimeTypeFileFilter } from './allowed-mime-types';
// 22/07/2026: Fix 5 (code review) - DTO validate UUID cho query `folderId`.
import { FindFilesQueryDto } from './dto/find-files-query.dto';

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

/** Module Tai lieu - Wireframe.md muc 5. */
@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    // 22/07/2026: Fix 5 (code review) - gop `folderId` + phan trang vao 1 DTO co validate UUID
    // (xem giai thich day du o dto/find-files-query.dto.ts), thay vi doc tho
    // `@Query('folderId') folderId: string | undefined`.
    @Query() query: FindFilesQueryDto,
  ) {
    return this.filesService.findAll(organizationId, query.folderId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  findOne(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.filesService.findOne(organizationId, id);
  }

  // 22/07/2026: bo sung query `disposition` de FE phan biet "Xem" (inline - trinh duyet tu
  // render truc tiep neu ho tro, vd PDF/anh/text) va "Tai xuong" (attachment - luon mo hop
  // thoai Luu tap tin) - truoc do URL luon khong dat Content-Disposition nen hanh vi mo/tai
  // phu thuoc "tinh co" vao Content-Type, khong the chu dong tach 2 hanh dong ro rang o FE.
  @Get(':id/download')
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  getDownloadUrl(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Query('disposition') disposition?: string,
  ) {
    return this.filesService.getDownloadUrl(organizationId, id, disposition === 'inline' ? 'inline' : 'attachment');
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
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Thieu file can tai len');
    return this.filesService.uploadNewVersion(organizationId, actorId, id, file);
  }

  @Post(':id/share')
  @RequirePermissions(PERMISSIONS.DOCUMENT_SHARE)
  share(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Body() dto: ShareFileDto,
  ) {
    return this.filesService.share(organizationId, actorId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_DELETE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
  ) {
    return this.filesService.remove(organizationId, actorId, id);
  }
}
