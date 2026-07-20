import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

/** Module Tai lieu - Wireframe.md muc 5. */
@ApiTags('Folders')
@ApiBearerAuth()
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query('parentFolderId') parentFolderId?: string,
  ) {
    return this.foldersService.findAll(organizationId, parentFolderId);
  }

  @Post()
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.foldersService.create(organizationId, actorId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_DELETE)
  remove(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.foldersService.remove(organizationId, id);
  }
}
