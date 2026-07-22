import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
// 22/07/2026: Fix 5 (code review) - DTO validate UUID cho query `parentFolderId`.
import { FindFoldersQueryDto } from './dto/find-folders-query.dto';

/** Module Tai lieu - Wireframe.md muc 5. */
@ApiTags('Folders')
@ApiBearerAuth()
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  // 22/07/2026: Fix 3 (code review) - bo sung @RequirePermissions con thieu. Day la endpoint DOC
  // DUY NHAT trong toan bo Document Service (ca FilesController lan cac endpoint con lai cua
  // chinh FoldersController) khong kiem tra quyen, cho phep BAT KY user da dang nhap (bat ke co
  // duoc gan quyen DOCUMENT_VIEW hay khong) liet ke toan bo cay thu muc cua to chuc.
  @Get()
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    // 22/07/2026: Fix 5 (code review) - doi sang DTO co validate UUID (xem giai thich day du o
    // dto/find-folders-query.dto.ts), thay vi doc tho `@Query('parentFolderId')`.
    @Query() query: FindFoldersQueryDto,
  ) {
    return this.foldersService.findAll(organizationId, query.parentFolderId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPLOAD)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.foldersService.create(organizationId, actorId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPLOAD)
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_DELETE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
  ) {
    return this.foldersService.remove(organizationId, actorId, id);
  }
}
