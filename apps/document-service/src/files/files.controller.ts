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
import { PaginationQueryDto, PERMISSIONS } from '@app/common-dto';
import { FilesService } from './files.service';
import { ShareFileDto } from './dto/share-file.dto';

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

/** Module Tai lieu - Wireframe.md muc 5. */
@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query('folderId') folderId: string | undefined,
    @Query() query: PaginationQueryDto,
  ) {
    return this.filesService.findAll(organizationId, folderId, query);
  }

  @Get(':id')
  findOne(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.filesService.findOne(organizationId, id);
  }

  @Get(':id/download')
  getDownloadUrl(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.filesService.getDownloadUrl(organizationId, id);
  }

  @Post('upload')
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } }))
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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } }))
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
